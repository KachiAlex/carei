import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import { useAutoSave } from '../hooks/useAutoSave'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { enqueue } from '../utils/offlineQueue'
import { fetchVisit, fetchClient, saveVisit, sendSOS, saveVisitDraft, getVisitDraft, getDrugInteractions, logMedication, getMedicationLogs, reportIncident, saveVoiceMemo } from '../api/client'
import { sendMedicationReminder, requestNotificationPermission } from '../utils/notifications'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  red: '#FF5A5F',
  amber: '#F6B73C',
  green: '#22C55E',
  lavender: '#A78BFA',
  g2: '#94A3B8',
}

// PBS Risk levels per client
const PBS_RISK_LEVELS: Record<string, 'green' | 'amber' | 'red'> = {
  'Mary Johnson': 'amber',
  'Tom Adams': 'green',
  'Aisha Khan': 'red',
}

export default function ActiveVisitScreen() {
  const params = useParams<{ id: string }>()
  const visitId = params?.id || ''
  const [, setLocation] = useLocation()

  const [visit, setVisit] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [clockedIn, setClockedIn] = useState(false)
  const [clockInAt, setClockInAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [tasks, setTasks] = useState<{ name: string; done: boolean; completedAt?: number }[]>([])
  const [fluid, setFluid] = useState(0)
  const [notes, setNotes] = useState('')
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [showVoiceDoc, setShowVoiceDoc] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [showClockOut, setShowClockOut] = useState(false)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [meds, setMeds] = useState<{
    name: string
    dose: string
    status: 'pending' | 'confirmed' | 'skipped' | 'refused'
    skipReason?: string
    isControlled?: boolean
    dueTime?: string
    adminNote?: string
    administeredAt?: string
    witnessName?: string
  }[]>([])
  const [showMedConfirm, setShowMedConfirm] = useState(false)
  const [selectedMed, setSelectedMed] = useState<string | null>(null)
  const [showSkipReason, setShowSkipReason] = useState(false)

  // Phase 4: Medication Module
  const [drugInteractions, setDrugInteractions] = useState<{ drug_a: string; drug_b: string; severity: string; description: string }[]>([])
  const [showMedAdmin, setShowMedAdmin] = useState(false)
  const [selectedMedForAdmin, setSelectedMedForAdmin] = useState<string | null>(null)
  const [adminTime, setAdminTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(Math.round(now.getMinutes() / 5) * 5).padStart(2, '0')}`
  })
  const [adminNotes, setAdminNotes] = useState('')
  const [witnessName, setWitnessName] = useState('')
  const [showNotGivenForm, setShowNotGivenForm] = useState(false)
  const [notGivenReason, setNotGivenReason] = useState('')
  const [notGivenAction, setNotGivenAction] = useState('')
  const [notGivenCarerSaid, setNotGivenCarerSaid] = useState('')
  const [notGivenFreeText, setNotGivenFreeText] = useState('')
  const [medsGivenToday, setMedsGivenToday] = useState<Set<string>>(new Set())

  // Phase 5: Vitals & Care Notes
  const [bpSystolic, setBpSystolic] = useState<string>('')
  const [bpDiastolic, setBpDiastolic] = useState<string>('')
  const [pulse, setPulse] = useState<string>('')
  const [o2Sat, setO2Sat] = useState<string>('')
  const [bpAdvisory, setBpAdvisory] = useState<string>('')
  const [nutritionNote, setNutritionNote] = useState('')
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [wellbeingNote, setWellbeingNote] = useState('')
  const [activeTab, setActiveTab] = useState<'tasks' | 'vitals' | 'notes'>('tasks')

  // Phase 6: Incident Reporting & Voice
  const [incidents, setIncidents] = useState<{ id: string; type: string; severity: string; description: string; timestamp: string }[]>([])
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [incidentType, setIncidentType] = useState('')
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [incidentNote, setIncidentNote] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [voiceMemos, setVoiceMemos] = useState<{ id: string; audioUrl: string; duration: number; createdAt: string }[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const dbSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase 3: Lone Worker Safety
  const [loneWorkerElapsed, setLoneWorkerElapsed] = useState(0)
  const [loneWorkerPaused, setLoneWorkerPaused] = useState(false)
  const loneWorkerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Phase 3: Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Phase 3: Care Cue
  const [showCareCue, setShowCareCue] = useState(false)
  const [currentCareCue, setCurrentCareCue] = useState('')

  // Phase 3: Meal prompt
  const [showMealPrompt, setShowMealPrompt] = useState(false)
  const [mealStatus, setMealStatus] = useState<'full' | 'half' | 'refused' | null>(null)

  // Phase 4: PBS Risk Bar
  const [pbsRiskLevel, setPbsRiskLevel] = useState<'green' | 'amber' | 'red'>('green')

  // Phase 4: Privacy Overlay
  const [privacyMode, setPrivacyMode] = useState(false)

  // Phase 4: Post-Medication Monitoring Timer (e.g., for Metformin nausea monitoring)
  const [postMedTimers, setPostMedTimers] = useState<Record<string, number>>({})
  const [activePostMedMonitor, setActivePostMedMonitor] = useState<string | null>(null)
  const postMedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useAutoSave(visitId, { visitId, elapsed, tasks, fluid, notes, meds, clockedIn, mealStatus, loneWorkerElapsed, bpSystolic, bpDiastolic, pulse, o2Sat, nutritionNote, selectedMood, wellbeingNote }, 3000)

  // Load visit + client from API, then DB data + draft
  useEffect(() => {
    if (!visitId) return
    let mounted = true

    async function load() {
      try {
        // Critical data: fetch visit and client in parallel
        const [v, c] = await Promise.all([
          fetchVisit(visitId).catch(() => null),
          fetchVisit(visitId).then((visit) => visit?.clientId ? fetchClient(visit.clientId).catch(() => null) : null).catch(() => null)
        ])

        if (!mounted) return
        if (v && v.id) setVisit(v)
        if (c) setClient(c)

        // Initialize tasks and meds from scheduled visit / client
        if (v?.tasks && Array.isArray(v.tasks)) {
          setTasks(v.tasks.map((t: string) => ({ name: t, done: false })))
        }
        if (c?.medications && Array.isArray(c.medications)) {
          setMeds(c.medications.map((m: any) => ({
            name: m.name,
            dose: m.dose || '',
            status: 'pending' as const,
            isControlled: m.isControlled || false,
            dueTime: m.dueTime || null,
          })))
        }

        // Set PBS Risk level based on client
        if (c?.name && PBS_RISK_LEVELS[c.name]) {
          setPbsRiskLevel(PBS_RISK_LEVELS[c.name])
        } else if (c?.supportFramework?.toLowerCase().includes('red')) {
          setPbsRiskLevel('red')
        } else if (c?.supportFramework?.toLowerCase().includes('amber')) {
          setPbsRiskLevel('amber')
        }

        // Load saved visit data from DB
        if (v && v.elapsed != null) {
          setElapsed(v.elapsed)
          if (v.tasks && Array.isArray(v.tasks)) setTasks(v.tasks)
          if (v.fluid != null) setFluid(v.fluid)
          if (v.notes) setNotes(v.notes)
          if (v.medications) setMeds(v.medications)
          if (v.clock_out_at) setClockedIn(false)
          if (v.bp_systolic != null) setBpSystolic(String(v.bp_systolic))
          if (v.bp_diastolic != null) setBpDiastolic(String(v.bp_diastolic))
          if (v.pulse != null) setPulse(String(v.pulse))
          if (v.o2_sat != null) setO2Sat(String(v.o2_sat))
          if (v.fluid_glasses != null) setFluid(v.fluid_glasses)
          if (v.meal_status) setMealStatus(v.meal_status)
          if (v.mood) setSelectedMood(v.mood)
          if (v.wellbeing_note) setWellbeingNote(v.wellbeing_note)
        }

        // CRITICAL: Set loading to false now so UI renders
        if (mounted) setLoading(false)

        // Load secondary data in background (non-blocking)
        if (c) {
          // Phase 4: Fetch drug interactions
          if (c.medications && Array.isArray(c.medications) && c.medications.length >= 2) {
            try {
              const drugNames = c.medications.map((m: any) => m.name)
              const interactionRes = await getDrugInteractions(drugNames)
              if (mounted && interactionRes.interactions) {
                setDrugInteractions(interactionRes.interactions)
              }
            } catch (err: any) { console.error('getDrugInteractions failed', err.message) }
          }

          // Phase 4: Fetch today's medication logs for overdose safeguard
          if (c.id) {
            try {
              const logsRes = await getMedicationLogs(c.id, true)
              if (mounted && logsRes.logs) {
                const given = new Set<string>(
                  logsRes.logs.filter((l: any) => l.status === 'given').map((l: any) => l.medication_name)
                )
                setMedsGivenToday(given)
              }
            } catch (err: any) { console.error('getMedicationLogs failed', err.message) }
          }
        }

        // Load draft in background
        try {
          const draft = await getVisitDraft(visitId)
          if (!mounted || !draft) return
          if (draft.elapsed != null) setElapsed(draft.elapsed)
          if (draft.tasks) setTasks(draft.tasks)
          if (draft.fluid != null) setFluid(draft.fluid)
          if (draft.notes) setNotes(draft.notes)
          if (draft.meds) setMeds(draft.meds)
          if (draft.clockedIn != null) setClockedIn(draft.clockedIn)
          if (draft.bpSystolic != null) setBpSystolic(draft.bpSystolic)
          if (draft.bpDiastolic != null) setBpDiastolic(draft.bpDiastolic)
          if (draft.pulse != null) setPulse(draft.pulse)
          if (draft.o2Sat != null) setO2Sat(draft.o2Sat)
          if (draft.nutritionNote) setNutritionNote(draft.nutritionNote)
          if (draft.selectedMood) setSelectedMood(draft.selectedMood)
          if (draft.wellbeingNote) setWellbeingNote(draft.wellbeingNote)
        } catch (err: any) { console.error('getVisitDraft failed', err.message) }
      } catch (err: any) { 
        console.error('load visit failed', err.message)
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [visitId])

  // Medication reminder notification
  useEffect(() => {
    if (!meds.length || !client) return
    const pending = meds.filter((m) => m.status === 'pending')
    if (pending.length > 0) {
      requestNotificationPermission().then(() => {
        sendMedicationReminder(client.name, pending[0].name)
      })
    }
  }, [client, meds])

  // Debounced auto-save to DB
  useEffect(() => {
    if (!visitId || !clockedIn) return
    if (dbSyncRef.current) clearTimeout(dbSyncRef.current)
    dbSyncRef.current = setTimeout(() => {
      const payload = {
        visitId,
        clientId: client?.id,
        clientName: client?.name,
        clientAge: client?.age,
        clientAddress: client?.address,
        visitTime: visit?.time,
        visitDuration: visit?.duration,
        elapsed,
        tasks,
        fluid,
        notes,
        medications: meds,
        mealStatus,
      }
      saveVisit(visitId, payload).catch(() => {})
    }, 5000)
    return () => { if (dbSyncRef.current) clearTimeout(dbSyncRef.current) }
  }, [visitId, elapsed, tasks, fluid, notes, meds, clockedIn, client, visit, mealStatus])

  useEffect(() => {
    if (clockedIn) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [clockedIn])

  // Phase 4: Post-medication monitoring timer (30 min countdown for certain meds)
  useEffect(() => {
    if (Object.keys(postMedTimers).length > 0) {
      postMedTimerRef.current = setInterval(() => {
        setPostMedTimers((prev) => {
          const updated = { ...prev }
          Object.keys(updated).forEach((med) => {
            if (updated[med] > 0) updated[med] -= 1
          })
          return updated
        })
      }, 1000)
    } else {
      if (postMedTimerRef.current) clearInterval(postMedTimerRef.current)
    }
    return () => { if (postMedTimerRef.current) clearInterval(postMedTimerRef.current) }
  }, [Object.keys(postMedTimers).length])

  // Phase 3: Lone Worker Safety timer — 25 min check-in window
  useEffect(() => {
    if (clockedIn && !loneWorkerPaused) {
      loneWorkerRef.current = setInterval(() => setLoneWorkerElapsed((e) => e + 1), 1000)
    } else {
      if (loneWorkerRef.current) clearInterval(loneWorkerRef.current)
    }
    return () => { if (loneWorkerRef.current) clearInterval(loneWorkerRef.current) }
  }, [clockedIn, loneWorkerPaused])

  // Phase 3: Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const toggleTask = (idx: number) => {
    setTasks((prev) => {
      const task = prev[idx]
      if (!task) return prev
      const now = Date.now()
      // Clamp timestamp to clock-in time
      const clampedAt = clockInAt ? Math.max(now, clockInAt) : now
      const updated = prev.map((t, i) => (i === idx ? { ...t, done: !t.done, completedAt: !t.done ? clampedAt : undefined } : t))

      // Show contextual care cue if task is being completed and client has care cues
      if (!task.done && client?.careCues && Array.isArray(client.careCues)) {
        const cue = client.careCues.find((c: string) => c.toLowerCase().includes(task.name.toLowerCase()))
          || client.careCues[idx % client.careCues.length]
        if (cue) {
          setCurrentCareCue(cue)
          setShowCareCue(true)
        }
      }

      // Show meal prompt when breakfast-related task is ticked
      if (!task.done && /breakfast|meal|food|prepare/i.test(task.name) && !mealStatus) {
        setShowMealPrompt(true)
      }

      return updated
    })
    triggerHaptic(HAPTIC_PATTERNS.tap)
  }

  const addFluid = () => {
    setFluid((f) => Math.min(f + 1, 12))
    triggerHaptic(HAPTIC_PATTERNS.tap)
  }

  const formatLoneWorkerTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}m ${String(s).padStart(2, '0')}s`
  }

  const loneWorkerOverdue = loneWorkerElapsed > 25 * 60

  // Phase 5: BP comparison against baseline
  const computeBpAdvisory = (sys: string, dia: string) => {
    const s = parseInt(sys, 10)
    const d = parseInt(dia, 10)
    if (isNaN(s) || isNaN(d)) return ''

    const baseSys = client?.bp_baseline_systolic
    const baseDia = client?.bp_baseline_diastolic
    let advisory = ''

    if (baseSys && baseDia) {
      const diffSys = s - baseSys
      const diffDia = d - baseDia
      if (diffSys > 15 || diffDia > 10) {
        advisory = `Elevated from baseline (${baseSys}/${baseDia})`
      } else if (s < 90 || d < 60) {
        advisory = 'Low BP — monitor client'
      }
    } else {
      if (s < 90 || d < 60) advisory = 'Low BP — monitor client'
    }

    return advisory
  }

  // Phase 4: Medication admin functions
  const openMedAdmin = (medName: string) => {
    setSelectedMedForAdmin(medName)
    const now = new Date()
    setAdminTime(`${String(now.getHours()).padStart(2, '0')}:${String(Math.round(now.getMinutes() / 5) * 5).padStart(2, '0')}`)
    setAdminNotes('')
    setWitnessName('')
    setShowMedAdmin(true)
  }

  const confirmMedAdmin = async () => {
    if (!selectedMedForAdmin || !client?.id) return

    // Overdose safeguard: check if already given today
    if (medsGivenToday.has(selectedMedForAdmin)) {
      if (!window.confirm(`⚠️ ${selectedMedForAdmin} has already been logged as given today. Confirm you want to log it again?`)) {
        setShowMedAdmin(false)
        return
      }
    }

    const [hours, minutes] = adminTime.split(':').map(Number)
    const administeredAt = new Date()
    administeredAt.setHours(hours, minutes, 0, 0)

    // Two-person sign-off for controlled meds
    const med = meds.find((m) => m.name === selectedMedForAdmin)
    if (med?.isControlled && !witnessName.trim()) {
      alert('Controlled medication requires a witness name. Please enter the witness name.')
      return
    }

    try {
      await logMedication({
        clientId: client.id,
        visitId,
        medicationName: selectedMedForAdmin,
        dose: med?.dose,
        status: 'given',
        witnessName: witnessName.trim() || undefined,
        notes: adminNotes || undefined,
        administeredAt: administeredAt.toISOString(),
      })
      setMedsGivenToday((prev) => new Set(prev).add(selectedMedForAdmin))
    } catch (err: any) {
      // If offline, queue it
      if (!navigator.onLine) {
        await enqueue({
          type: 'medication-log',
          payload: {
            clientId: client.id,
            visitId,
            medicationName: selectedMedForAdmin,
            dose: med?.dose,
            status: 'given',
            witnessName: witnessName.trim() || undefined,
            notes: adminNotes || undefined,
            administeredAt: administeredAt.toISOString(),
          },
        })
        setMedsGivenToday((prev) => new Set(prev).add(selectedMedForAdmin))
      }
    }

    setMeds((prev) =>
      prev.map((m) =>
        m.name === selectedMedForAdmin
          ? {
              ...m,
              status: 'confirmed' as const,
              administeredAt: administeredAt.toISOString(),
              witnessName: witnessName.trim() || undefined,
              adminNote: adminNotes || undefined,
            }
          : m
      )
    )

    // Start post-medication monitoring timer (30 min) for certain meds
    const medForMonitoring = meds.find((m) => m.name === selectedMedForAdmin)
    if (medForMonitoring && (medForMonitoring.name.toLowerCase().includes('metformin') || medForMonitoring.adminNote?.toLowerCase().includes('monitor'))) {
      setActivePostMedMonitor(selectedMedForAdmin)
      setPostMedTimers((prev) => ({ ...prev, [selectedMedForAdmin]: 30 * 60 })) // 30 minutes
    }

    setShowMedAdmin(false)
    triggerHaptic(HAPTIC_PATTERNS.confirm)
  }

  const openNotGivenForm = (medName: string) => {
    setSelectedMedForAdmin(medName)
    setNotGivenReason('')
    setNotGivenAction('')
    setNotGivenCarerSaid('')
    setNotGivenFreeText('')
    setShowNotGivenForm(true)
  }

  const submitNotGiven = async () => {
    if (!selectedMedForAdmin || !client?.id) return

    const medNotGiven = meds.find((m) => m.name === selectedMedForAdmin)

    try {
      await logMedication({
        clientId: client.id,
        visitId,
        medicationName: selectedMedForAdmin,
        dose: medNotGiven?.dose,
        status: 'refused',
        reason: notGivenReason,
        notes: `Action: ${notGivenAction} | Carer said: ${notGivenCarerSaid} | Note: ${notGivenFreeText}`,
      })
    } catch {
      if (!navigator.onLine) {
        await enqueue({
          type: 'medication-log',
          payload: {
            clientId: client.id,
            visitId,
            medicationName: selectedMedForAdmin,
            dose: medNotGiven?.dose,
            status: 'refused',
            reason: notGivenReason,
            notes: `Action: ${notGivenAction} | Carer said: ${notGivenCarerSaid} | Note: ${notGivenFreeText}`,
          },
        })
      }
    }

    setMeds((prev) =>
      prev.map((m) =>
        m.name === selectedMedForAdmin
          ? { ...m, status: 'refused' as const, skipReason: notGivenReason }
          : m
      )
    )
    setShowNotGivenForm(false)
    triggerHaptic(HAPTIC_PATTERNS.confirm)
  }

  // Phase 6: Incident reporting
  const submitIncident = async () => {
    if (!incidentType.trim()) {
      alert('Please select an incident type.')
      return
    }
    try {
      await reportIncident({
        visitId,
        clientId: client?.id,
        clientName: client?.name,
        type: incidentType,
        description: incidentNote,
        severity: incidentSeverity,
      })
      setIncidents((prev) => [
        {
          id: 'local-' + Date.now(),
          type: incidentType,
          severity: incidentSeverity,
          description: incidentNote,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch {
      if (!navigator.onLine) {
        await enqueue({
          type: 'visit',
          payload: {
            type: 'incident',
            visitId,
            clientId: client?.id,
            clientName: client?.name,
            incidentType,
            description: incidentNote,
            severity: incidentSeverity,
          },
        })
        setIncidents((prev) => [
          {
            id: 'local-' + Date.now(),
            type: incidentType,
            severity: incidentSeverity,
            description: incidentNote,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ])
      }
    }
    setIncidentType('')
    setIncidentNote('')
    setIncidentSeverity('medium')
    setShowIncidentForm(false)
    triggerHaptic(HAPTIC_PATTERNS.confirm)
  }

  // Phase 6: Voice memo recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
      setRecordDuration(0)
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1)
      }, 1000)
    } catch {
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setIsRecording(false)
  }

  const discardRecording = () => {
    setRecordedBlob(null)
    setRecordDuration(0)
  }

  const saveRecording = async () => {
    if (!recordedBlob) return
    // Warn if recording is likely too large (>1.5MB blob ≈ >2MB base64)
    if (recordedBlob.size > 1_500_000) {
      alert('Recording too large. Please keep recordings under ~90 seconds.')
      return
    }
    try {
      const reader = new FileReader()
      reader.readAsDataURL(recordedBlob)
      reader.onloadend = async () => {
        const base64 = reader.result as string
        try {
          await saveVoiceMemo({
            visitId,
            clientId: client?.id,
            audioUrl: base64,
            duration: recordDuration,
          })
        } catch {
          if (!navigator.onLine) {
            await enqueue({
              type: 'voice-memo',
              payload: {
                visitId,
                clientId: client?.id,
                audioUrl: base64,
                duration: recordDuration,
              },
            })
          }
        }
      }
      setVoiceMemos((prev) => [
        {
          id: 'local-' + Date.now(),
          audioUrl: URL.createObjectURL(recordedBlob),
          duration: recordDuration,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setRecordedBlob(null)
      setRecordDuration(0)
      triggerHaptic(HAPTIC_PATTERNS.confirm)
    } catch {
      // fallback: just add to local list
      setVoiceMemos((prev) => [
        {
          id: 'local-' + Date.now(),
          audioUrl: URL.createObjectURL(recordedBlob),
          duration: recordDuration,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setRecordedBlob(null)
      setRecordDuration(0)
    }
  }

  const formatRecordTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const getDueTimeAlert = (dueTime?: string | null) => {
    if (!dueTime) return null
    const now = new Date()
    const [h, m] = dueTime.split(':').map(Number)
    const due = new Date()
    due.setHours(h, m, 0, 0)
    const diffMin = (now.getTime() - due.getTime()) / 60000
    if (diffMin >= 60) return { type: 'red-locked', label: 'Over 1 hour late' }
    if (diffMin >= 30) return { type: 'red', label: `${Math.round(diffMin)} min late` }
    if (diffMin >= -15 && diffMin < 0) return { type: 'amber', label: 'Due soon' }
    if (diffMin >= 0 && diffMin < 30) return { type: 'teal', label: 'Due now' }
    return null
  }

  const startVoiceDoc = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice documentation not supported in this browser')
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript
      }
      setTranscript(txt)
    }
    rec.onend = () => setIsTranscribing(false)
    rec.start()
    recognitionRef.current = rec
    setIsTranscribing(true)
  }

  const stopVoiceDoc = () => {
    recognitionRef.current?.stop()
    setIsTranscribing(false)
  }

  const saveVoiceDoc = () => {
    setNotes((n) => (n ? n + '\n' + transcript : transcript))
    setTranscript('')
    setShowVoiceDoc(false)
  }

  const handleSOS = () => {
    setShowSOSConfirm(true)
    triggerHaptic(HAPTIC_PATTERNS.sos)
    setTimeout(() => setShowSOSConfirm(false), 15000)
  }

  const confirmSOS = async () => {
    setShowSOSConfirm(false)
    triggerHaptic(HAPTIC_PATTERNS.sos)
    const payload = { visitId, location: client?.address, timestamp: new Date().toISOString() }
    if (!navigator.onLine) {
      await enqueue({ type: 'sos', payload })
      alert('SOS queued — will send when back online.')
      return
    }
    try {
      await sendSOS(payload)
      alert('SOS Alert Sent! Supervisor notified.')
    } catch {
      alert('Failed to send SOS. Please retry.')
    }
  }

  const confirmMed = (medName: string) => {
    setMeds((prev) =>
      prev.map((m) => (m.name === medName ? { ...m, status: 'confirmed' as const } : m))
    )
    triggerHaptic(HAPTIC_PATTERNS.confirm)
    setShowMedConfirm(false)
  }

  const skipMed = (medName: string, reason: string) => {
    setMeds((prev) =>
      prev.map((m) => (m.name === medName ? { ...m, status: 'skipped' as const, skipReason: reason } : m))
    )
    triggerHaptic(HAPTIC_PATTERNS.confirm)
    setShowSkipReason(false)
    setShowMedConfirm(false)
  }

  const pendingMedsCount = meds.filter((m) => m.status === 'pending').length
  const allMedsHandled = meds.every((m) => m.status !== 'pending')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' as const }}
            className="w-8 h-8 border-2 border-slate-200 border-t-teal-400 rounded-full"
          />
          <div className="text-sm">Loading visit...</div>
        </motion.div>
      </div>
    )
  }

  if (!visit || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Visit not found</motion.div>
      </div>
    )
  }

  // Pre-clock-in briefing view
  if (!clockedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans items-center">
        <div className="w-full max-w-3xl flex flex-col min-h-screen">
        <div
          className="px-6 py-5 text-white shrink-0"
          style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation('/dashboard')}
            className="relative z-10 text-white/60 hover:text-white text-sm flex items-center gap-1 mb-4 bg-transparent border-none cursor-pointer transition-colors py-1 px-1 -ml-1 rounded-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </motion.button>
          <div className="relative z-10 flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}25, ${COLORS.teal2}15)`, color: COLORS.teal }}>
              {client.name.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">{client.name}</h1>
              <p className="text-white/50 text-sm">{visit.time} · {visit.duration}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 overflow-auto">
          {/* Flags */}
          {visit.flags?.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                <div className="text-xs font-bold text-slate-700">Important Flags</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {visit.flags.map((f: string) => (
                  <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,90,95,0.06)', color: COLORS.red, border: '1px solid rgba(255,90,95,0.1)' }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Briefing Cards */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Shift Briefing</h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.teal}12, ${COLORS.teal2}08)` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Key Observations</div>
                  <div className="text-xs text-slate-500">{client.conditions?.join(', ') || 'None recorded'}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.teal}12, ${COLORS.teal2}08)` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Open Tasks</div>
                  <div className="text-xs text-slate-500">{visit.tasks?.join(', ') || 'None recorded'}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.teal}12, ${COLORS.teal2}08)` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Care Preferences</div>
                  <div className="text-xs text-slate-500">{client.preferences}</div>
                  {client.emergencyContact && (
                    <div className="text-[11px] text-slate-400 mt-1">Emergency: {client.emergencyContact}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Medications */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-800">Medications Due</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>{client.medications?.length || 0} items</span>
            </div>
            <div className="flex flex-col gap-2">
              {client.medications?.map((med: any, i: number) => (
                <motion.div
                  key={med.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between text-xs py-2.5 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(79,209,197,0.08)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z"/></svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700">{med.name}</span>
                        {med.isControlled && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded-md uppercase tracking-wider" style={{ background: `${COLORS.red}10`, color: COLORS.red, border: `1px solid ${COLORS.red}20` }}>
                            Controlled
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400">
                        {med.dose}{med.dueTime ? ` · Due ${med.dueTime}` : ''}{med.frequency ? ` · ${med.frequency}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.teal }} />
                </motion.div>
              ))}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setClockedIn(true)
              setClockInAt(Date.now())
              setLoneWorkerElapsed(0)
            }}
            className="w-full py-4 rounded-2xl font-bold text-base cursor-pointer border-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy, boxShadow: `0 8px 32px ${COLORS.teal}30` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            Clock In
          </motion.button>
        </div>
        </div>
      </div>
    )
  }

  // Active Visit view
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative items-center">
      {/* Privacy Overlay - Blurs screen when privacy mode is active */}
      {privacyMode && (
        <div 
          className="fixed inset-0 z-40 backdrop-blur-xl bg-slate-900/80 flex items-center justify-center"
          onClick={() => setPrivacyMode(false)}
        >
          <div className="text-center text-white p-8">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Privacy Mode Active</h3>
            <p className="text-white/60 text-sm mb-6">Sensitive information is hidden. Tap anywhere to resume.</p>
            <button 
              onClick={() => setPrivacyMode(false)}
              className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm"
            >
              Show Screen
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col min-h-screen relative">
      {/* Header */}
      <div
        className="px-4 py-4 text-white shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[60px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
        <div className="relative z-10 flex items-center justify-between mb-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setClockedIn(false)}
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors py-1 px-1 -ml-1 rounded-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </motion.button>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(79,209,197,0.15)', border: '1px solid rgba(79,209,197,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal }} />
            <div className="font-mono text-xs font-bold" style={{ color: COLORS.teal }}>{formatTime(elapsed)}</div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}25, ${COLORS.teal2}15)`, color: COLORS.teal }}>
            {client.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{client.name}</div>
            <div className="text-[11px] text-white/40">{visit.time} · {visit.duration}</div>
          </div>
          {/* Privacy Toggle Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setPrivacyMode(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
            title="Privacy Mode"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </motion.button>
        </div>

        {/* PBS Risk Bar */}
        <div className="relative z-10 mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">PBS Risk Level</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: pbsRiskLevel === 'red' ? 'rgba(255,90,95,0.2)' : pbsRiskLevel === 'amber' ? 'rgba(246,183,60,0.2)' : 'rgba(34,197,94,0.2)',
                color: pbsRiskLevel === 'red' ? COLORS.red : pbsRiskLevel === 'amber' ? COLORS.amber : COLORS.green,
                border: `1px solid ${pbsRiskLevel === 'red' ? 'rgba(255,90,95,0.3)' : pbsRiskLevel === 'amber' ? 'rgba(246,183,60,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {pbsRiskLevel === 'red' ? '🔴 RED' : pbsRiskLevel === 'amber' ? '🟠 AMBER' : '🟢 GREEN'}
            </span>
          </div>
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-white/10">
            <div className="flex-1 rounded-full transition-all duration-300" style={{ background: pbsRiskLevel === 'green' ? COLORS.green : 'rgba(255,255,255,0.1)' }} />
            <div className="flex-1 rounded-full transition-all duration-300" style={{ background: pbsRiskLevel === 'amber' ? COLORS.amber : 'rgba(255,255,255,0.1)' }} />
            <div className="flex-1 rounded-full transition-all duration-300" style={{ background: pbsRiskLevel === 'red' ? COLORS.red : 'rgba(255,255,255,0.1)' }} />
          </div>
          <div className="flex justify-between text-[9px] text-white/30 mt-1">
            <span>Green</span>
            <span>Amber</span>
            <span>Red</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Phase 4: Drug Interaction Alert */}
        {drugInteractions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-2xl p-4 border"
            style={{
              background: drugInteractions.some((i) => i.severity === 'major')
                ? 'rgba(255,90,95,0.06)'
                : 'rgba(246,183,60,0.06)',
              borderColor: drugInteractions.some((i) => i.severity === 'major')
                ? `${COLORS.red}30`
                : `${COLORS.amber}30`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: drugInteractions.some((i) => i.severity === 'major')
                    ? 'rgba(255,90,95,0.12)'
                    : 'rgba(246,183,60,0.12)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={drugInteractions.some((i) => i.severity === 'major') ? COLORS.red : COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold mb-1" style={{ color: drugInteractions.some((i) => i.severity === 'major') ? COLORS.red : COLORS.amber }}>
                  Drug Interaction Alert
                </div>
                {drugInteractions.map((i, idx) => (
                  <div key={idx} className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-medium">{i.drug_a} + {i.drug_b}:</span> {i.description}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Phase 4: Per-Medication Cards */}
        {meds.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Medications</div>
              <div className="text-[10px] font-medium text-slate-500">
                {meds.filter((m) => m.status === 'confirmed').length}/{meds.length} given
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {meds.map((med, i) => {
                const alert = getDueTimeAlert(med.dueTime)
                const isGiven = med.status === 'confirmed'
                const isRefused = med.status === 'refused'
                return (
                  <motion.div
                    key={med.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl p-4 border"
                    style={{
                      background: isGiven
                        ? 'rgba(34,197,94,0.04)'
                        : isRefused
                          ? 'rgba(255,90,95,0.04)'
                          : alert?.type === 'red-locked'
                            ? 'rgba(255,90,95,0.06)'
                            : 'white',
                      borderColor: isGiven
                        ? 'rgba(34,197,94,0.2)'
                        : isRefused
                          ? 'rgba(255,90,95,0.2)'
                          : alert?.type === 'red-locked'
                            ? `${COLORS.red}30`
                            : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    {/* Duplicate Alert Banner */}
                    {medsGivenToday.has(med.name) && !isGiven && !isRefused && (
                      <div className="mb-2 rounded-lg p-2 border" style={{ background: 'rgba(246,183,60,0.08)', borderColor: `${COLORS.amber}40` }}>
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                          </svg>
                          <span className="text-[10px] font-bold" style={{ color: COLORS.amber }}>Already given today — possible duplicate</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{med.name}</span>
                        {med.isControlled && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                            style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}25` }}
                          >
                            Controlled
                          </span>
                        )}
                        {(med as any).timeSensitive && !isGiven && !isRefused && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                            style={{ background: `${COLORS.amber}10`, color: COLORS.amber, border: `1px solid ${COLORS.amber}20` }}
                          >
                            ⏰ Time-Critical
                          </span>
                        )}
                        {alert && !isGiven && !isRefused && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                            style={{
                              background: alert.type.startsWith('red') ? `${COLORS.red}10` : alert.type === 'amber' ? `${COLORS.amber}10` : `${COLORS.teal}10`,
                              color: alert.type.startsWith('red') ? COLORS.red : alert.type === 'amber' ? COLORS.amber : COLORS.teal,
                              border: `1px solid ${alert.type.startsWith('red') ? COLORS.red : alert.type === 'amber' ? COLORS.amber : COLORS.teal}20`,
                            }}
                          >
                            {alert.label}
                          </span>
                        )}
                      </div>
                      {isGiven && med.witnessName && (
                        <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: COLORS.teal }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                          Witnessed by {med.witnessName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{med.dose}{med.dueTime ? ` · Due ${med.dueTime}` : ''}</div>
                    {med.adminNote && (
                      <div className="text-[11px] text-slate-500 mb-2 italic">{med.adminNote}</div>
                    )}

                    {/* Drug Interaction Warning */}
                    {drugInteractions.length > 0 && !isGiven && !isRefused && (
                      <div className="mb-2">
                        {drugInteractions
                          .filter((di) => di.drug_a === med.name || di.drug_b === med.name)
                          .map((di, idx) => (
                            <div key={idx} className="rounded-lg p-2 border mb-1" style={{ background: di.severity === 'major' ? 'rgba(255,90,95,0.06)' : 'rgba(246,183,60,0.06)', borderColor: di.severity === 'major' ? `${COLORS.red}30` : `${COLORS.amber}30` }}>
                              <div className="flex items-start gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={di.severity === 'major' ? COLORS.red : COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                                </svg>
                                <div className="text-[10px]" style={{ color: di.severity === 'major' ? COLORS.red : COLORS.amber }}>
                                  <span className="font-bold">{di.severity === 'major' ? '⚠️ Major Interaction' : 'Interaction'}:</span> {di.drug_a} + {di.drug_b} — {di.description}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Post-Medication Monitoring Timer */}
                    {isGiven && activePostMedMonitor === med.name && postMedTimers[med.name] > 0 && (
                      <div className="mb-2 rounded-lg p-2 border" style={{ background: 'rgba(79,209,197,0.08)', borderColor: `${COLORS.teal}40` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: COLORS.teal }} />
                            <span className="text-[10px] font-medium text-slate-600">Monitoring for side effects...</span>
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: COLORS.teal }}>
                            {Math.floor(postMedTimers[med.name] / 60)}:{String(postMedTimers[med.name] % 60).padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    )}
                    {isGiven || isRefused ? (
                      <span
                        className="text-xs font-medium px-2 py-1 rounded-lg"
                        style={{
                          color: isGiven ? '#22c55e' : COLORS.red,
                          background: isGiven ? 'rgba(34,197,94,0.1)' : 'rgba(255,90,95,0.08)',
                        }}
                      >
                        {isGiven ? '✓ Given' : '⊘ Refused'}
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openMedAdmin(med.name)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer"
                          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                        >
                          Give
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openNotGivenForm(med.name)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                          style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                        >
                          Not Given
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Phase 3: Offline Banner */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-2xl p-3 border flex items-center gap-2"
            style={{ background: 'rgba(246,183,60,0.06)', borderColor: `${COLORS.amber}30` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" x2="12.01" y1="20" y2="20" />
            </svg>
            <span className="text-xs font-medium" style={{ color: COLORS.amber }}>Offline — data will sync when reconnected</span>
          </motion.div>
        )}

        {/* Phase 3: Lone Worker Safety */}
        <div
          className="rounded-2xl p-4 border mb-3 flex items-center justify-between"
          style={{
            background: loneWorkerOverdue ? 'rgba(255,90,95,0.08)' : 'white',
            borderColor: loneWorkerOverdue ? `${COLORS.red}30` : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: loneWorkerOverdue ? 'rgba(255,90,95,0.12)' : 'rgba(79,209,197,0.08)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={loneWorkerOverdue ? COLORS.red : COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500">Lone Worker Safety</div>
              {loneWorkerOverdue ? (
                <div className="text-sm font-bold" style={{ color: COLORS.red }}>Check-in overdue!</div>
              ) : (
                <div className="text-sm font-bold text-slate-800">{formatLoneWorkerTime(loneWorkerElapsed)}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoneWorkerElapsed(0); triggerHaptic(HAPTIC_PATTERNS.tap) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-none cursor-pointer"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >
              Check In
            </button>
            <button
              onClick={() => setLoneWorkerPaused((p) => !p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: loneWorkerPaused ? 'rgba(79,209,197,0.08)' : 'white' }}
            >
              {loneWorkerPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
          {[
            { key: 'tasks', label: 'Tasks' },
            { key: 'vitals', label: 'Vitals' },
            { key: 'notes', label: 'Care Notes' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all"
              style={{
                background: activeTab === tab.key ? 'white' : 'transparent',
                color: activeTab === tab.key ? '#1e293b' : '#94a3b8',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Tasks */}
        {activeTab === 'tasks' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
              <h3 className="font-bold text-sm text-slate-800 mb-3">Tasks</h3>
              <div className="flex flex-col gap-2">
                {tasks.map((task, idx) => (
                  <motion.button
                    key={idx}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleTask(idx)}
                    className="flex items-center gap-3 text-left py-3 px-2 rounded-xl cursor-pointer border-none bg-transparent hover:bg-slate-50 transition-colors min-h-[48px]"
                  >
                    <motion.div
                      animate={{
                        scale: task.done ? 1.1 : 1,
                        backgroundColor: task.done ? COLORS.teal : 'transparent',
                        borderColor: task.done ? COLORS.teal : '#cbd5e1',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border"
                    >
                      {task.done && (
                        <motion.svg
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </motion.svg>
                      )}
                    </motion.div>
                    <span className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.name}</span>
                    {task.completedAt && (
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(task.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Notes within Tasks tab */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
              <h3 className="font-bold text-sm text-slate-800 mb-2">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add observations..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                rows={3}
              />
            </div>
          </motion.div>
        )}

        {/* Tab: Vitals */}
        {activeTab === 'vitals' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 mb-3">
            {/* BP Baseline header */}
            {client?.bp_baseline_systolic && client?.bp_baseline_diastolic && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Personal BP Baseline</div>
                <div className="text-sm font-bold text-slate-800">{client.bp_baseline_systolic}/{client.bp_baseline_diastolic} mmHg</div>
              </div>
            )}

            {/* Vital Signs form */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Vital Signs</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">Systolic (mmHg)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bpSystolic}
                    onChange={(e) => {
                      const val = e.target.value
                      setBpSystolic(val)
                      setBpAdvisory(computeBpAdvisory(val, bpDiastolic))
                    }}
                    placeholder="120"
                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">Diastolic (mmHg)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bpDiastolic}
                    onChange={(e) => {
                      const val = e.target.value
                      setBpDiastolic(val)
                      setBpAdvisory(computeBpAdvisory(bpSystolic, val))
                    }}
                    placeholder="80"
                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">Pulse (bpm)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72"
                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">O₂ Sat (%)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={o2Sat}
                    onChange={(e) => setO2Sat(e.target.value)}
                    placeholder="98"
                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                  />
                </div>
              </div>

              {/* BP advisory */}
              {bpAdvisory && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl p-3 border"
                  style={{ background: 'rgba(255,90,95,0.06)', borderColor: `${COLORS.red}25` }}
                >
                  <div className="text-xs font-bold" style={{ color: COLORS.red }}>⚠️ {bpAdvisory}</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab: Care Notes */}
        {activeTab === 'notes' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 mb-3">
            {/* Fluid Counter (Care Notes) */}
            <div
              className="rounded-2xl p-4 border flex items-center justify-between"
              style={{
                background: fluid >= 6 ? 'rgba(34,197,94,0.06)' : 'white',
                borderColor: fluid >= 6 ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div>
                <div className="text-xs text-slate-500">Fluid Intake</div>
                <div className="font-bold text-lg" style={{ color: fluid >= 6 ? '#22c55e' : '#1e293b' }}>{fluid} / 12 glasses</div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={addFluid}
                disabled={fluid >= 12}
                className="w-11 h-11 rounded-full text-white text-xl font-bold flex items-center justify-center cursor-pointer border-none touch-target disabled:opacity-40"
                style={{ background: fluid >= 6 ? '#22c55e' : `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                aria-label="Add 1 glass fluid"
              >
                +
              </motion.button>
            </div>

            {/* Meal Status */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Meal Status</div>
              <div className="flex gap-2">
                {[
                  { key: 'full', label: 'Full' },
                  { key: 'half', label: 'Half' },
                  { key: 'refused', label: 'Refused' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setMealStatus(opt.key as any)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all"
                    style={{
                      background: mealStatus === opt.key ? `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` : '#f1f5f9',
                      color: mealStatus === opt.key ? 'white' : '#64748b',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nutrition Note */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Nutrition Notes</div>
              <textarea
                value={nutritionNote}
                onChange={(e) => setNutritionNote(e.target.value)}
                placeholder="Meal preferences, appetite, concerns..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                rows={2}
              />
            </div>

            {/* Mood Selector */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mood</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'Happy', icon: '🙂' },
                  { key: 'Calm', icon: '😌' },
                  { key: 'Anxious', icon: '😰' },
                  { key: 'Distressed', icon: '😢' },
                  { key: 'Tired', icon: '😴' },
                  { key: 'In Pain', icon: '😣' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMood(m.key)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5"
                    style={{
                      background: selectedMood === m.key ? `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` : '#f1f5f9',
                      color: selectedMood === m.key ? 'white' : '#64748b',
                    }}
                  >
                    <span>{m.icon}</span>
                    {m.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Wellbeing Note */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Wellbeing Note</div>
              <textarea
                value={wellbeingNote}
                onChange={(e) => setWellbeingNote(e.target.value)}
                placeholder="General observations, mood, behaviour, concerns..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                rows={3}
              />
            </div>
          </motion.div>
        )}

        {/* Phase 6: Incident Reporting */}
        <div className="bg-white rounded-2xl border border-slate-200 mb-3 overflow-hidden">
          <button
            onClick={() => setShowIncidentForm((v) => !v)}
            className="w-full flex items-center justify-between p-4 cursor-pointer border-none bg-transparent"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,90,95,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-slate-800">Report Incident</span>
            </div>
            <span className="text-xs font-medium" style={{ color: COLORS.teal }}>{showIncidentForm ? 'Close' : 'Open'}</span>
          </button>

          {showIncidentForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="px-4 pb-4 flex flex-col gap-3"
            >
              {/* Severity - Enhanced with icons and descriptions */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Incident Severity</div>
                <div className="flex gap-2">
                  {[
                    { key: 'low', label: 'Low', color: '#22c55e', icon: '✓', desc: 'Minor issue, no harm' },
                    { key: 'medium', label: 'Medium', color: COLORS.amber, icon: '⚠', desc: 'Moderate concern' },
                    { key: 'high', label: 'High', color: COLORS.red, icon: '🚨', desc: 'Serious incident' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setIncidentSeverity(s.key as any)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all flex flex-col items-center gap-1"
                      style={{
                        background: incidentSeverity === s.key ? s.color : 'white',
                        color: incidentSeverity === s.key ? 'white' : '#64748b',
                        borderColor: incidentSeverity === s.key ? s.color : 'rgba(0,0,0,0.08)',
                        boxShadow: incidentSeverity === s.key ? `0 2px 8px ${s.color}30` : 'none',
                      }}
                    >
                      <span className="text-sm">{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  {incidentSeverity === 'low' && 'Minor issue with no immediate risk to client'}
                  {incidentSeverity === 'medium' && 'Moderate concern requiring supervisor notification'}
                  {incidentSeverity === 'high' && 'Serious incident requiring immediate escalation'}
                </div>
              </div>

              {/* Type */}
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none border border-slate-100 focus:border-teal transition-colors appearance-none"
              >
                <option value="">Select incident type...</option>
                <option value="Fall">Fall</option>
                <option value="Medication Error">Medication Error</option>
                <option value="Injury">Injury</option>
                <option value="Behavioral">Behavioral</option>
                <option value="Environmental">Environmental</option>
                <option value="Equipment">Equipment</option>
                <option value="Other">Other</option>
              </select>

              {/* Note */}
              <textarea
                value={incidentNote}
                onChange={(e) => setIncidentNote(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                rows={3}
              />

              <button
                onClick={submitIncident}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.amber})` }}
              >
                Submit Incident
              </button>
            </motion.div>
          )}

          {/* Incident list */}
          {incidents.length > 0 && (
            <div className="px-4 pb-3 flex flex-col gap-2">
              {incidents.slice(0, 3).map((inc) => (
                <div key={inc.id} className="flex items-center gap-2 rounded-xl p-2.5 bg-slate-50">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: inc.severity === 'high' ? COLORS.red : inc.severity === 'medium' ? COLORS.amber : '#22c55e',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">{inc.type}</div>
                    {inc.description && <div className="text-[10px] text-slate-500 truncate">{inc.description}</div>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(inc.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase 6: Voice Memo Recorder */}
        <div className="bg-white rounded-2xl border border-slate-200 mb-3 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-slate-800">Voice Memo</span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-500">{formatRecordTime(recordDuration)}</span>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 flex flex-col gap-3">
            {!isRecording && !recordedBlob && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(90deg, ${COLORS.lavender}, ${COLORS.teal})` }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                Tap to Record
              </motion.button>
            )}

            {isRecording && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer flex items-center justify-center gap-2"
                style={{ background: COLORS.red }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
                Stop Recording
              </motion.button>
            )}

            {recordedBlob && !isRecording && (
              <div className="flex flex-col gap-2">
                <audio src={URL.createObjectURL(recordedBlob)} controls className="w-full h-10" />
                <div className="flex gap-2">
                  <button
                    onClick={discardRecording}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all"
                    style={{ background: '#f1f5f9', color: '#64748b' }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveRecording}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all"
                    style={{ background: `linear-gradient(90deg, ${COLORS.lavender}, ${COLORS.teal})` }}
                  >
                    Save Memo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved memos list */}
          {voiceMemos.length > 0 && (
            <div className="px-4 pb-3 flex flex-col gap-2">
              {voiceMemos.slice(0, 3).map((memo) => (
                <div key={memo.id} className="flex items-center gap-2 rounded-xl p-2.5 bg-slate-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">Voice Memo</div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatRecordTime(memo.duration)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowVoiceDoc(true)}
            className="py-3.5 rounded-xl text-xs font-semibold border cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] transition-all duration-200 hover:shadow-sm"
            style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#64748b', background: 'white' }}
            aria-label="Voice documentation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            Voice Doc
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowBodyMap(true)}
            className="py-3.5 rounded-xl text-xs font-semibold border cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] transition-all duration-200 hover:shadow-sm"
            style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#64748b', background: 'white' }}
            aria-label="Body map photo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7"/><path d="M15 7h6v6"/></svg>
            Body Map
          </motion.button>
        </div>

        {/* Clock Out */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (!allMedsHandled) {
              alert('Please confirm or skip all medications before clocking out.')
              setShowMedConfirm(true)
              return
            }
            setShowClockOut(true)
          }}
          className="w-full py-4 rounded-2xl font-bold text-base cursor-pointer border-none mb-6 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy, boxShadow: `0 8px 32px ${COLORS.teal}30` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          Clock Out
        </motion.button>
      </div>

      {/* SOS Floating Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleSOS}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white font-bold text-sm shadow-lg cursor-pointer border-none z-50 flex items-center justify-center"
        style={{ background: COLORS.red, boxShadow: '0 8px 32px rgba(255,90,95,0.4)' }}
        aria-label="SOS Emergency"
      >
        SOS
      </motion.button>

      {/* Voice Documentation Modal */}
      {showVoiceDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-3">Voice Documentation</h3>
            <div className="bg-slate-50 rounded-xl p-3 mb-3 min-h-[60px] text-sm text-slate-600">
              {transcript || (isTranscribing ? 'Listening...' : 'Tap record to start')}
            </div>
            <div className="flex gap-2 mb-4">
              {!isTranscribing ? (
                <button
                  onClick={startVoiceDoc}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.red }}
                >
                  ● Record
                </button>
              ) : (
                <button
                  onClick={stopVoiceDoc}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                >
                  ⏹ Stop
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowVoiceDoc(false); setTranscript(''); stopVoiceDoc() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={saveVoiceDoc}
                disabled={!transcript}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-40"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body Map Modal */}
      {showBodyMap && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-3">Body Map Photo</h3>
            <p className="text-sm text-slate-500 mb-4">Take a photo of any skin concerns, bruises, or wounds. This will be auto-tagged to this visit.</p>
            <input
              type="file"
              accept="image/*"
              className="w-full mb-4 text-sm text-slate-500"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setNotes((n) => n + '\n[Body map photo captured]')
                  setShowBodyMap(false)
                }
              }}
            />
            <button
              onClick={() => setShowBodyMap(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Clock Out Confirmation */}
      {showClockOut && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-2">Clock Out?</h3>
            <div className="text-sm text-slate-500 mb-4">
              <div>Time: {formatTime(elapsed)}</div>
              <div>Fluid: {fluid} ml</div>
              <div>Tasks: {tasks.filter((t) => t.done).length}/{tasks.length} done</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClockOut(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClockOut(false)
                  triggerHaptic(HAPTIC_PATTERNS.clockOut)
                  const snapshot = {
                    visitId: visit.id,
                    clientId: client.id,
                    clientName: client.name,
                    clientAge: client.age,
                    clientAddress: client.address,
                    visitTime: visit.time,
                    visitDuration: visit.duration,
                    elapsed,
                    tasks: tasks.map((t) => ({ name: t.name, done: t.done, completedAt: t.completedAt })),
                    fluid,
                    notes,
                    medications: meds.map((m) => ({
                      name: m.name,
                      dose: m.dose,
                      status: m.status,
                      skipReason: m.skipReason,
                      isControlled: m.isControlled,
                      administeredAt: m.administeredAt,
                      witnessName: m.witnessName,
                      adminNote: m.adminNote,
                      dueTime: m.dueTime,
                    })),
                    mealStatus,
                    loneWorkerElapsed,
                    bpSystolic: bpSystolic ? parseInt(bpSystolic, 10) : null,
                    bpDiastolic: bpDiastolic ? parseInt(bpDiastolic, 10) : null,
                    pulse: pulse ? parseInt(pulse, 10) : null,
                    o2Sat: o2Sat ? parseInt(o2Sat, 10) : null,
                    nutritionNote,
                    mood: selectedMood,
                    wellbeingNote,
                    clockInAt: clockInAt ? new Date(clockInAt).toISOString() : null,
                    clockOutAt: new Date().toISOString(),
                    status: 'completed',
                    incidents,
                    voiceMemos,
                  }
                  try { await saveVisitDraft(visit.id, { snapshot }) } catch (err: any) { console.error('saveVisitDraft failed', err.message) }
                  try { await saveVisit(visit.id, { ...snapshot, clientId: client.id }) } catch (err: any) { console.error('saveVisit failed', err.message) }
                  setLocation(`/summary/${visit.id}`)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Confirm Clock Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication Confirmation Modal */}
      {showMedConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-slate-800 mb-1">Medication Confirmation</h3>
            <p className="text-xs text-slate-500 mb-4">{client.name} · Tap to confirm each medication</p>
            <div className="flex flex-col gap-2 mb-4">
              {meds.map((med, i) => (
                <motion.div
                  key={med.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between p-3 rounded-xl border"
                  style={{
                    background: med.status === 'confirmed' ? 'rgba(79,209,197,0.06)' : med.status === 'skipped' ? 'rgba(255,90,95,0.04)' : 'white',
                    borderColor: med.status === 'confirmed' ? 'rgba(79,209,197,0.3)' : med.status === 'skipped' ? 'rgba(255,90,95,0.2)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-700">{med.name}</div>
                    <div className="text-xs text-slate-400">{med.dose}</div>
                    {med.status === 'skipped' && med.skipReason && (
                      <div className="text-[10px] text-red-400 mt-0.5">Skipped: {med.skipReason}</div>
                    )}
                  </div>
                  {med.status === 'pending' ? (
                    <div className="flex gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => confirmMed(med.name)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-none cursor-pointer"
                        style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                      >
                        Confirm
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setSelectedMed(med.name); setShowSkipReason(true) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                        style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                      >
                        Skip
                      </motion.button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ color: med.status === 'confirmed' ? COLORS.teal : COLORS.red, background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : 'rgba(255,90,95,0.08)' }}>
                      {med.status === 'confirmed' ? '✓ Confirmed' : '⊘ Skipped'}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
            <button
              onClick={() => setShowMedConfirm(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Skip Reason Modal */}
      {showSkipReason && selectedMed && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-1">Skip {selectedMed}</h3>
            <p className="text-xs text-slate-500 mb-4">Why was this medication not given?</p>
            <div className="flex flex-col gap-2 mb-4">
              {['Client refused', 'Client asleep', 'Client unavailable', 'Other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => skipMed(selectedMed, reason)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm border cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#475569', background: 'white' }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowSkipReason(false); setSelectedMed(null) }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,90,95,0.1)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2 text-slate-800">Emergency Alert</h3>
            <p className="text-sm text-slate-500 mb-6">This will immediately notify your supervisor and log your GPS location.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSOSConfirm(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'transparent' }}>Cancel</button>
              <button onClick={confirmSOS} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: COLORS.red }}>Send Alert</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Auto-cancels in 15 seconds</p>
          </div>
        </div>
      )}

      {/* Phase 3: Care Cue Modal */}
      {showCareCue && currentCareCue && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 max-w-sm w-full"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.12)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800">Care Cue</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">{currentCareCue}</p>
            <button
              onClick={() => setShowCareCue(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >
              Acknowledge
            </button>
          </motion.div>
        </div>
      )}

      {/* Phase 3: Meal Prompt Modal */}
      {showMealPrompt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 max-w-sm w-full"
          >
            <h3 className="font-bold text-slate-800 mb-1">Meal Status</h3>
            <p className="text-xs text-slate-500 mb-4">How much did the client eat?</p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { key: 'full', label: 'Full Meal', color: '#22c55e' },
                { key: 'half', label: 'Half Meal', color: COLORS.amber },
                { key: 'refused', label: 'Refused', color: COLORS.red },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setMealStatus(opt.key as any)
                    setShowMealPrompt(false)
                    triggerHaptic(HAPTIC_PATTERNS.tap)
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm border cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{
                    borderColor: mealStatus === opt.key ? `${opt.color}40` : 'rgba(0,0,0,0.08)',
                    background: mealStatus === opt.key ? `${opt.color}08` : 'white',
                    color: mealStatus === opt.key ? opt.color : '#475569',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMealPrompt(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Skip for now
            </button>
          </motion.div>
        </div>
      )}

      {/* Phase 4: Medication Admin Modal */}
      {showMedAdmin && selectedMedForAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[85vh] overflow-auto"
          >
            <h3 className="font-bold text-slate-800 mb-1">Give {selectedMedForAdmin}</h3>
            <p className="text-xs text-slate-500 mb-4">{client?.name} · Confirm administration details</p>

            <div className="flex flex-col gap-3 mb-4">
              {/* Time picker */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Time Given</label>
                <input
                  type="time"
                  value={adminTime}
                  onChange={(e) => setAdminTime(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none border border-slate-100 focus:border-teal transition-colors"
                />
              </div>

              {/* Admin notes */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Administration Note</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Taken with water, no issues..."
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                  rows={2}
                />
              </div>

              {/* Controlled medication witness */}
              {meds.find((m) => m.name === selectedMedForAdmin)?.isControlled && (
                <div
                  className="rounded-xl p-3 border"
                  style={{ background: 'rgba(255,90,95,0.04)', borderColor: `${COLORS.red}20` }}
                >
                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    Two-Person Sign-Off Required
                  </div>
                  <input
                    type="text"
                    value={witnessName}
                    onChange={(e) => setWitnessName(e.target.value)}
                    placeholder="Witness name..."
                    className="w-full bg-white rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-200 focus:border-red-300 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Overdue alert in modal */}
            {(() => {
              const med = meds.find((m) => m.name === selectedMedForAdmin)
              const alert = getDueTimeAlert(med?.dueTime)
              if (alert && alert.type.startsWith('red')) {
                return (
                  <div className="mb-4 rounded-xl p-3 border" style={{ background: 'rgba(255,90,95,0.06)', borderColor: `${COLORS.red}25` }}>
                    <div className="text-xs font-bold" style={{ color: COLORS.red }}>⚠️ {alert.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Document reason for delay in notes.</div>
                  </div>
                )
              }
              return null
            })()}

            <div className="flex gap-2">
              <button
                onClick={() => setShowMedAdmin(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmMedAdmin}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Confirm Given
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Phase 4: Not Given Structured Refusal Form */}
      {showNotGivenForm && selectedMedForAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[85vh] overflow-auto"
          >
            <h3 className="font-bold text-slate-800 mb-1">Not Given: {selectedMedForAdmin}</h3>
            <p className="text-xs text-slate-500 mb-4">{client?.name} · Complete structured refusal record</p>

            <div className="flex flex-col gap-3 mb-4">
              {/* Reason */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Reason</label>
                <select
                  value={notGivenReason}
                  onChange={(e) => setNotGivenReason(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none border border-slate-100 focus:border-teal transition-colors appearance-none"
                >
                  <option value="">Select reason...</option>
                  <option value="Client refused">Client refused</option>
                  <option value="Client asleep">Client asleep</option>
                  <option value="Client unavailable">Client unavailable</option>
                  <option value="Nausea / vomiting">Nausea / vomiting</option>
                  <option value="Swallowing difficulty">Swallowing difficulty</option>
                  <option value="Contraindicated today">Contraindicated today</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* What carer said */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">What carer said</label>
                <input
                  type="text"
                  value={notGivenCarerSaid}
                  onChange={(e) => setNotGivenCarerSaid(e.target.value)}
                  placeholder={'e.g. "I\'ll try again later"'}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                />
              </div>

              {/* Action taken */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Action taken</label>
                <input
                  type="text"
                  value={notGivenAction}
                  onChange={(e) => setNotGivenAction(e.target.value)}
                  placeholder="e.g. Offered again in 30 minutes"
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                />
              </div>

              {/* Free-text note */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Additional note</label>
                <textarea
                  value={notGivenFreeText}
                  onChange={(e) => setNotGivenFreeText(e.target.value)}
                  placeholder="Any additional observations..."
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowNotGivenForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={submitNotGiven}
                disabled={!notGivenReason}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-40"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Record Not Given
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  )
}

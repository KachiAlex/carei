import { useState, useRef, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { saveBodyMapMark, getBodyMapMarks, deleteBodyMapMark } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

// Zone-based categories like CAREiSource
const MARK_CATEGORIES: Record<string, { color: string; label: string; icon: string }> = {
  'pressure-sore': { color: '#FF5A5F', label: 'Pressure Sore', icon: '🔴' },
  bruising: { color: '#8B5CF6', label: 'Bruising', icon: '💜' },
  mark: { color: '#F6B73C', label: 'Mark', icon: '�' },
  redness: { color: '#F97316', label: 'Redness', icon: '�' },
}

interface BodyMark {
  id: string
  visit_id: string
  client_id?: string
  carer_id?: string
  zone: string
  side: 'anterior' | 'posterior'
  type: string
  note: string
  photoUrl?: string
  createdAt: string
}

// Body zones definition (like CAREiSource)
const BODY_ZONES = {
  anterior: [
    { id: 'head', label: 'Head', x: 50, y: 12, w: 20, h: 20, rx: 10 },
    { id: 'neck', label: 'Neck', x: 50, y: 26, w: 10, h: 6 },
    { id: 'l-shoulder', label: 'L Shoulder', x: 32, y: 35, w: 15, h: 12 },
    { id: 'r-shoulder', label: 'R Shoulder', x: 68, y: 35, w: 15, h: 12 },
    { id: 'chest', label: 'Chest', x: 50, y: 40, w: 24, h: 18 },
    { id: 'abdomen', label: 'Abdomen', x: 50, y: 58, w: 22, h: 15 },
    { id: 'l-arm', label: 'L Arm', x: 22, y: 48, w: 8, h: 28 },
    { id: 'r-arm', label: 'R Arm', x: 78, y: 48, w: 8, h: 28 },
    { id: 'l-thigh', label: 'L Thigh', x: 40, y: 78, w: 12, h: 25 },
    { id: 'r-thigh', label: 'R Thigh', x: 60, y: 78, w: 12, h: 25 },
    { id: 'l-shin', label: 'L Shin', x: 40, y: 105, w: 10, h: 22 },
    { id: 'r-shin', label: 'R Shin', x: 60, y: 105, w: 10, h: 22 },
    { id: 'l-foot', label: 'L Foot', x: 38, y: 128, w: 12, h: 6 },
    { id: 'r-foot', label: 'R Foot', x: 62, y: 128, w: 12, h: 6 },
  ],
  posterior: [
    { id: 'head-b', label: 'Head (Back)', x: 50, y: 12, w: 20, h: 20, rx: 10 },
    { id: 'neck-b', label: 'Neck (Back)', x: 50, y: 26, w: 10, h: 6 },
    { id: 'upper-back', label: 'Upper Back', x: 50, y: 38, w: 24, h: 14 },
    { id: 'lower-back', label: 'Lower Back', x: 50, y: 54, w: 22, h: 12 },
    { id: 'sacrum', label: 'Sacrum', x: 50, y: 68, w: 14, h: 6 },
    { id: 'l-buttock', label: 'L Buttock', x: 40, y: 75, w: 12, h: 10 },
    { id: 'r-buttock', label: 'R Buttock', x: 60, y: 75, w: 12, h: 10 },
    { id: 'l-thigh-b', label: 'L Thigh (Back)', x: 40, y: 88, w: 12, h: 20 },
    { id: 'r-thigh-b', label: 'R Thigh (Back)', x: 60, y: 88, w: 12, h: 20 },
    { id: 'l-calf', label: 'L Calf', x: 40, y: 110, w: 10, h: 18 },
    { id: 'r-calf', label: 'R Calf', x: 60, y: 110, w: 10, h: 18 },
    { id: 'l-heel', label: 'L Heel', x: 40, y: 130, w: 10, h: 5 },
    { id: 'r-heel', label: 'R Heel', x: 60, y: 130, w: 10, h: 5 },
  ],
}

export default function BodyMapScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/body-map/:visitId')
  const visitId = params?.visitId || ''
  const [side, setSide] = useState<'anterior' | 'posterior'>('anterior')
  const [marks, setMarks] = useState<BodyMark[]>([])
  const [showMarkForm, setShowMarkForm] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [markType, setMarkType] = useState('pressure-sore')
  const [markNote, setMarkNote] = useState('')
  const [selectedMark, setSelectedMark] = useState<BodyMark | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [allClientMarks, setAllClientMarks] = useState<BodyMark[]>([])
  const [comparisonMode, setComparisonMode] = useState(false)
  const [compareVisitId, setCompareVisitId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadMarks() {
      try {
        const data = await getBodyMapMarks(visitId)
        if (data && Array.isArray(data)) {
          setMarks(data)
        }
      } catch (err) {
        console.error('Failed to load body map marks:', err)
      }
    }
    if (visitId) loadMarks()
  }, [visitId])

  useEffect(() => {
    async function loadClientMarks() {
      if (!showHistory) return
      try {
        const clientId = marks[0]?.client_id || null
        if (clientId) {
          const data = await getBodyMapMarks(undefined, clientId)
          if (data && Array.isArray(data)) {
            setAllClientMarks(data)
          }
        }
      } catch (err) {
        console.error('Failed to load client body map marks:', err)
      }
    }
    loadClientMarks()
  }, [showHistory, marks])

  // Zone-based marking (like CAREiSource)
  const handleZoneClick = (zoneId: string) => {
    setSelectedZone(zoneId)
    setMarkType('pressure-sore')
    setMarkNote('')
    setPhotoPreview(null)
    setShowMarkForm(true)
    setSelectedMark(null)
  }

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerPhotoCapture = () => {
    fileInputRef.current?.click()
  }

  const addMark = async () => {
    if (!selectedZone) return
    try {
      const zone = BODY_ZONES[side].find(z => z.id === selectedZone)
      const res = await saveBodyMapMark({
        visitId,
        x: zone?.x || 50,
        y: zone?.y || 50,
        side,
        zone: selectedZone,
        type: markType,
        note: markNote,
        photoUrl: photoPreview || undefined,
      })
      if (res?.id) {
        const newMark: BodyMark = {
          id: res.id,
          visit_id: visitId,
          zone: selectedZone,
          side,
          type: markType,
          note: markNote,
          photoUrl: photoPreview || undefined,
          createdAt: new Date().toISOString(),
        }
        setMarks([...marks, newMark])
        setShowMarkForm(false)
        setSelectedZone(null)
        setPhotoPreview(null)
      }
    } catch (err) {
      console.error('Failed to save body map mark:', err)
    }
  }

  const deleteMark = async (id: string) => {
    try {
      await deleteBodyMapMark(id)
      setMarks(marks.filter((m) => m.id !== id))
      setSelectedMark(null)
    } catch (err) {
      console.error('Failed to delete body map mark:', err)
    }
  }

  const filteredMarks = marks.filter((m) => m.side === side)
  const marksForZone = (zoneId: string) => filteredMarks.filter(m => m.zone === zoneId)
  const currentZones = BODY_ZONES[side]

  // Success screen after saving
  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: COLORS.darkNavy }}>
        <div className="text-5xl">✅</div>
        <div className="text-white font-bold text-xl">Body Map Saved</div>
        <div className="text-white/60 text-sm text-center">
          {marks.length} mark{marks.length !== 1 ? 's' : ''} recorded and added to the audit trail
        </div>
        <button
          onClick={() => visitId && setLocation(`/visit/${visitId}`)}
          className="px-8 py-3.5 rounded-xl font-bold text-sm border-none cursor-pointer mt-4"
          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
        >
          Back to Visit
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: COLORS.darkNavy }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0">
        <button onClick={() => visitId && setLocation(`/visit/${visitId}`)} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Visit
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-lg font-bold">Skin Integrity Map</h1>
            <div className="text-white/60 text-xs mt-0.5">Tap a body zone to mark it</div>
          </div>
          <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ color: COLORS.red, background: 'rgba(255,90,95,0.12)' }}>Audit</span>
        </div>
        {/* Side toggle */}
        <div className="flex gap-2 mt-2">
          {(['anterior', 'posterior'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all capitalize"
              style={{
                background: side === s ? COLORS.teal : 'rgba(255,255,255,0.08)',
                color: side === s ? COLORS.darkNavy : 'white',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Zone-based SVG Body (like CAREiSource) */}
      <div className="flex-1 flex flex-col items-center p-4 bg-slate-50">
        {/* Mark Type Selector */}
        <div className="flex gap-2 mb-4 flex-wrap justify-center">
          {Object.entries(MARK_CATEGORIES).map(([key, { color, label, icon }]) => (
            <button
              key={key}
              onClick={() => setMarkType(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              style={{
                background: markType === key ? `${color}20` : 'white',
                borderColor: markType === key ? color : 'rgba(0,0,0,0.08)',
                color: markType === key ? color : '#64748b',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* SVG with clickable zones */}
        <svg viewBox="0 0 100 140" className="w-full max-w-xs bg-white rounded-lg shadow-sm">
          {currentZones.map((zone) => {
            const zoneMarks = marksForZone(zone.id)
            const hasMarks = zoneMarks.length > 0
            const lastMark = hasMarks ? zoneMarks[zoneMarks.length - 1] : null
            const lastColor = lastMark ? MARK_CATEGORIES[lastMark.type]?.color : null

            return (
              <g
                key={zone.id}
                onClick={() => handleZoneClick(zone.id)}
                style={{ cursor: 'pointer' }}
                className="transition-opacity hover:opacity-80"
              >
                {/* Zone shape */}
                {zone.rx ? (
                  <ellipse
                    cx={zone.x}
                    cy={zone.y}
                    rx={zone.w / 2}
                    ry={zone.h / 2}
                    fill={hasMarks && lastColor ? `${lastColor}30` : 'rgba(248,250,252,0.8)'}
                    stroke={hasMarks && lastColor ? lastColor : '#cbd5e1'}
                    strokeWidth={hasMarks ? 2 : 1}
                  />
                ) : (
                  <rect
                    x={zone.x - zone.w / 2}
                    y={zone.y - zone.h / 2}
                    width={zone.w}
                    height={zone.h}
                    rx={4}
                    fill={hasMarks && lastColor ? `${lastColor}30` : 'rgba(248,250,252,0.8)'}
                    stroke={hasMarks && lastColor ? lastColor : '#cbd5e1'}
                    strokeWidth={hasMarks ? 2 : 1}
                  />
                )}
                {/* Mark indicator */}
                {hasMarks && lastColor && (
                  <circle
                    cx={zone.x + zone.w / 2 - 3}
                    cy={zone.y - zone.h / 2 + 3}
                    r={3}
                    fill={lastColor}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Recorded Marks List */}
        {filteredMarks.length > 0 && (
          <div className="w-full mt-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Recorded Marks</div>
            <div className="flex flex-col gap-2">
              {filteredMarks.map((mark, i) => {
                const zone = currentZones.find(z => z.id === mark.zone)
                return (
                  <div
                    key={mark.id}
                    onClick={() => setSelectedMark(mark)}
                    className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: MARK_CATEGORIES[mark.type]?.color }} />
                    <span className="text-xs text-white/80">{MARK_CATEGORIES[mark.type]?.label}</span>
                    <span className="text-[10px] text-white/40">·</span>
                    <span className="text-[10px] text-white/60">{zone?.label || mark.zone}</span>
                    {mark.photoUrl && <span className="text-[10px] ml-auto">📷</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Save Body Map Button */}
        <div className="w-full mt-6 pb-4">
          <div className="text-[10px] text-white/50 text-center mb-3">
            Tap any zone to mark it with: <span style={{ color: MARK_CATEGORIES[markType]?.color, fontWeight: 600 }}>{MARK_CATEGORIES[markType]?.label}</span>
          </div>
          <button
            onClick={() => setSaved(true)}
            disabled={marks.length === 0}
            className="w-full py-3.5 rounded-xl font-bold text-sm border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: marks.length > 0 ? `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` : 'rgba(255,255,255,0.1)',
              color: marks.length > 0 ? COLORS.darkNavy : 'rgba(255,255,255,0.5)'
            }}
          >
            Save Body Map ({marks.length} mark{marks.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>

      {/* Phase 5: Enhanced Mark Form Modal with category selector and photo capture */}
      {showMarkForm && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setShowMarkForm(false)}>
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm text-slate-800 mb-3">Add Body Mark</h3>
            
            {/* Category Selector */}
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Category</div>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {Object.entries(MARK_CATEGORIES).map(([key, { color, label, icon }]) => (
                <button
                  key={key}
                  onClick={() => setMarkType(key)}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-semibold cursor-pointer border transition-all"
                  style={{
                    background: markType === key ? color : 'white',
                    color: markType === key ? 'white' : '#64748b',
                    borderColor: markType === key ? color : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <span className="text-sm">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Note Input */}
            <textarea
              value={markNote}
              onChange={(e) => setMarkNote(e.target.value)}
              placeholder="Add notes about size, severity, or any observations..."
              className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors mb-3"
              rows={2}
            />

            {/* Photo Capture */}
            <div className="mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              {!photoPreview ? (
                <button
                  onClick={triggerPhotoCapture}
                  className="w-full py-3 rounded-xl text-sm font-semibold border cursor-pointer flex items-center justify-center gap-2"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: '#f8fafc' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="13" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Take Photo
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={photoPreview} alt="Mark preview" className="w-full h-32 object-cover" />
                  <button
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={addMark}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >
              Save Mark
            </button>
          </motion.div>
        </div>
      )}

      {/* Phase 5: Enhanced Selected Mark Detail with photo */}
      {selectedMark && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setSelectedMark(null)}>
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{MARK_CATEGORIES[selectedMark.type]?.icon || '🔴'}</span>
              <span className="w-3 h-3 rounded-full" style={{ background: MARK_CATEGORIES[selectedMark.type]?.color || COLORS.amber }} />
              <h3 className="font-bold text-sm text-slate-800">{MARK_CATEGORIES[selectedMark.type]?.label || selectedMark.type}</h3>
              <span className="text-[10px] text-slate-400 ml-auto">
                {new Date(selectedMark.createdAt).toLocaleDateString()}
              </span>
            </div>
            {selectedMark.photoUrl && (
              <div className="mb-3 rounded-xl overflow-hidden">
                <img src={selectedMark.photoUrl} alt="Mark detail" className="w-full h-40 object-cover" />
              </div>
            )}
            {selectedMark.note && <p className="text-sm text-slate-600 mb-3">{selectedMark.note}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMark(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'white' }}
              >
                Close
              </button>
              <button
                onClick={() => deleteMark(selectedMark.id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: COLORS.red }}
              >
                Remove
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* History Timeline Modal */}
      {showHistory && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setShowHistory(false)}>
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800">Mark History</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setComparisonMode(!comparisonMode)}
                  className="text-xs px-2 py-1 rounded border cursor-pointer"
                  style={{ 
                    background: comparisonMode ? COLORS.teal : 'white',
                    color: comparisonMode ? 'white' : '#64748b',
                    borderColor: comparisonMode ? COLORS.teal : 'rgba(0,0,0,0.08)'
                  }}
                >
                  {comparisonMode ? 'Exit Compare' : 'Compare'}
                </button>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {comparisonMode ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 mb-2">Select a previous visit to compare with current</p>
                {Array.from(new Set(allClientMarks.map(m => m.visit_id)))
                  .filter(vid => vid !== visitId)
                  .sort((a, b) => {
                    const aDate = allClientMarks.find(m => m.visit_id === a)?.createdAt || ''
                    const bDate = allClientMarks.find(m => m.visit_id === b)?.createdAt || ''
                    return new Date(bDate).getTime() - new Date(aDate).getTime()
                  })
                  .map(vid => (
                    <button
                      key={vid}
                      onClick={() => setCompareVisitId(vid)}
                      className="w-full text-left p-3 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: compareVisitId === vid ? `${COLORS.teal}10` : 'white',
                        borderColor: compareVisitId === vid ? COLORS.teal : 'rgba(0,0,0,0.08)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Visit {vid.slice(-6)}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(allClientMarks.find(m => m.visit_id === vid)?.createdAt || '').toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {allClientMarks.filter(m => m.visit_id === vid).length} marks
                      </div>
                    </button>
                  ))}
                
                {compareVisitId && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Comparison Summary</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Current marks:</span>
                        <span className="font-semibold">{marks.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Previous marks:</span>
                        <span className="font-semibold">{allClientMarks.filter(m => m.visit_id === compareVisitId).length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">New marks:</span>
                        <span className="font-semibold text-green-600">
                          {marks.filter(m => !allClientMarks.find(pm => pm.visit_id === compareVisitId && pm.zone === m.zone)).length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              allClientMarks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No history available</p>
              ) : (
                <div className="space-y-4">
                  {allClientMarks
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((mark) => (
                      <div key={mark.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{MARK_CATEGORIES[mark.type]?.icon || '🔴'}</span>
                          <span className="text-xs font-semibold text-slate-700">{MARK_CATEGORIES[mark.type]?.label || mark.type}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">
                            {new Date(mark.createdAt).toLocaleDateString()} {new Date(mark.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mb-1">
                          {mark.side === 'anterior' ? 'Front' : 'Back'} • Zone: {BODY_ZONES[mark.side].find(z => z.id === mark.zone)?.label || mark.zone}
                        </div>
                        {mark.note && <p className="text-xs text-slate-600">{mark.note}</p>}
                        {mark.photoUrl && (
                          <div className="mt-2 rounded-lg overflow-hidden">
                            <img src={mark.photoUrl} alt="Mark photo" className="w-full h-20 object-cover" />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

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

// Phase 5: Enhanced Category Selector per document spec
const MARK_CATEGORIES: Record<string, { color: string; label: string; icon: string }> = {
  wound: { color: '#FF5A5F', label: 'Wound', icon: '🩹' },
  bruise: { color: '#A78BFA', label: 'Bruise', icon: '💜' },
  redness: { color: '#F6B73C', label: 'Redness', icon: '🔴' },
  swelling: { color: '#F59E0B', label: 'Swelling', icon: '📈' },
  rash: { color: '#22C55E', label: 'Rash', icon: '🔷' },
}

interface BodyMark {
  id: string
  visit_id: string
  client_id?: string
  carer_id?: string
  x: number
  y: number
  side: 'anterior' | 'posterior'
  type: string
  note: string
  photoUrl?: string
  createdAt: string
}

export default function BodyMapScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/body-map/:visitId')
  const visitId = params?.visitId || ''
  const svgRef = useRef<SVGSVGElement>(null)
  const [side, setSide] = useState<'anterior' | 'posterior'>('anterior')
  const [marks, setMarks] = useState<BodyMark[]>([])
  const [showMarkForm, setShowMarkForm] = useState(false)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)
  const [markType, setMarkType] = useState('wound')
  const [markNote, setMarkNote] = useState('')
  const [selectedMark, setSelectedMark] = useState<BodyMark | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [allClientMarks, setAllClientMarks] = useState<BodyMark[]>([])
  const [comparisonMode, setComparisonMode] = useState(false)
  const [compareVisitId, setCompareVisitId] = useState<string | null>(null)

  useEffect(() => {
    // Load marks from backend API
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

  // Load all client marks for history view
  useEffect(() => {
    async function loadClientMarks() {
      if (!showHistory) return
      try {
        // Extract clientId from current marks
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

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setClickPos({ x, y })
    setMarkType('wound')
    setMarkNote('')
    setPhotoPreview(null)
    setShowMarkForm(true)
    setSelectedMark(null)
  }

  // Phase 5: Photo capture for body map marks
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
    if (!clickPos) return
    try {
      const res = await saveBodyMapMark({
        visitId,
        x: clickPos.x,
        y: clickPos.y,
        side,
        type: markType,
        note: markNote,
        photoUrl: photoPreview || undefined,
      })
      if (res?.id) {
        const newMark: BodyMark = {
          id: res.id,
          visit_id: visitId,
          x: clickPos.x,
          y: clickPos.y,
          side,
          type: markType,
          note: markNote,
          photoUrl: photoPreview || undefined,
          createdAt: new Date().toISOString(),
        }
        setMarks([...marks, newMark])
        setShowMarkForm(false)
        setClickPos(null)
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-white/60 hover:text-white bg-transparent border-none cursor-pointer transition-colors">
              {showHistory ? 'Current' : 'History'}
            </button>
            <span className="text-xs text-white/40">Tap body to mark</span>
          </div>
        </div>
        <h1 className="font-serif text-lg font-bold">Body Map</h1>
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

      {/* SVG Body */}
      <div className="flex-1 flex items-center justify-center p-4 relative bg-slate-50 border-2 border-slate-300 rounded-lg">
        <svg
          ref={svgRef}
          viewBox="0 0 100 180"
          className="w-full max-w-xs bg-white"
        >
          {/* Body outline */}
          {side === 'anterior' ? (
            <>
              <ellipse cx="50" cy="12" rx="10" ry="10" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <path d="M35 22 L65 22 L60 50 L40 50 Z" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="40" y="50" width="20" height="40" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="32" y="55" width="6" height="30" rx="2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="62" y="55" width="6" height="30" rx="2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="40" y="90" width="8" height="45" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="52" y="90" width="8" height="45" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
            </>
          ) : (
            <>
              <ellipse cx="50" cy="12" rx="10" ry="10" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <path d="M35 22 L65 22 L60 50 L40 50 Z" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="40" y="50" width="20" height="40" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="32" y="55" width="6" height="30" rx="2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="62" y="55" width="6" height="30" rx="2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="40" y="90" width="8" height="45" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
              <rect x="52" y="90" width="8" height="45" rx="3" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
            </>
          )}
          {/* Marks */}
          {filteredMarks.map((mark) => (
            <g key={mark.id} onClick={(e) => { e.stopPropagation(); setSelectedMark(mark) }} style={{ cursor: 'pointer' }}>
              <circle
                cx={mark.x}
                cy={mark.y}
                r="3.5"
                fill={MARK_CATEGORIES[mark.type]?.color || COLORS.amber}
                stroke="white"
                strokeWidth="0.8"
              />
              {/* Photo indicator */}
              {mark.photoUrl && (
                <g transform={`translate(${mark.x + 4}, ${mark.y - 8})`}>
                  <rect x="0" y="0" width="6" height="6" rx="1" fill="#4FD1C5" />
                  <text x="3" y="4.5" fontSize="4" textAnchor="middle" fill="white">📷</text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Phase 5: Enhanced Legend with all categories */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center">
          {Object.entries(MARK_CATEGORIES).map(([key, { color, label, icon }]) => (
            <div key={key} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-100">
              <span className="text-xs">{icon}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] font-medium text-slate-600">{label}</span>
            </div>
          ))}
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
                          {marks.filter(m => !allClientMarks.find(pm => pm.visit_id === compareVisitId && Math.abs(pm.x - m.x) < 5 && Math.abs(pm.y - m.y) < 5)).length}
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
                          {mark.side === 'anterior' ? 'Front' : 'Back'} • Position: {mark.x}%, {mark.y}%
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

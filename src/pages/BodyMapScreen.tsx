import { useState, useRef, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

const MARK_TYPE_COLORS: Record<string, string> = {
  skin_integrity: '#22c55e',
  injury: '#FF5A5F',
  pressure_area: '#F6B73C',
}

interface BodyMark {
  id: string
  x: number
  y: number
  side: 'anterior' | 'posterior'
  type: string
  note: string
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
  const [markType, setMarkType] = useState('skin_integrity')
  const [markNote, setMarkNote] = useState('')
  const [selectedMark, setSelectedMark] = useState<BodyMark | null>(null)

  useEffect(() => {
    // Load marks from localStorage for demo
    const saved = localStorage.getItem(`body-map-${visitId}`)
    if (saved) setMarks(JSON.parse(saved))
  }, [visitId])

  const saveMarks = (newMarks: BodyMark[]) => {
    setMarks(newMarks)
    localStorage.setItem(`body-map-${visitId}`, JSON.stringify(newMarks))
  }

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setClickPos({ x, y })
    setMarkType('skin_integrity')
    setMarkNote('')
    setShowMarkForm(true)
    setSelectedMark(null)
  }

  const addMark = () => {
    if (!clickPos) return
    const id = 'bm-' + Date.now()
    const newMark: BodyMark = {
      id,
      x: clickPos.x,
      y: clickPos.y,
      side,
      type: markType,
      note: markNote,
    }
    saveMarks([...marks, newMark])
    setShowMarkForm(false)
    setClickPos(null)
  }

  const deleteMark = (id: string) => {
    saveMarks(marks.filter((m) => m.id !== id))
    setSelectedMark(null)
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
          <span className="text-xs text-white/40">Tap body to mark</span>
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
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <svg
          ref={svgRef}
          viewBox="0 0 100 180"
          className="w-full max-w-xs cursor-crosshair"
          onClick={handleSvgClick}
        >
          {/* Body outline */}
          {side === 'anterior' ? (
            <>
              <ellipse cx="50" cy="12" rx="10" ry="10" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <path d="M35 22 L65 22 L60 50 L40 50 Z" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="40" y="50" width="20" height="40" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="32" y="55" width="6" height="30" rx="2" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="62" y="55" width="6" height="30" rx="2" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="40" y="90" width="8" height="45" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="52" y="90" width="8" height="45" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
            </>
          ) : (
            <>
              <ellipse cx="50" cy="12" rx="10" ry="10" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <path d="M35 22 L65 22 L60 50 L40 50 Z" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="40" y="50" width="20" height="40" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="32" y="55" width="6" height="30" rx="2" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="62" y="55" width="6" height="30" rx="2" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="40" y="90" width="8" height="45" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="52" y="90" width="8" height="45" rx="3" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
            </>
          )}
          {/* Marks */}
          {filteredMarks.map((mark) => (
            <g key={mark.id} onClick={(e) => { e.stopPropagation(); setSelectedMark(mark) }} style={{ cursor: 'pointer' }}>
              <circle
                cx={mark.x}
                cy={mark.y}
                r="3"
                fill={MARK_TYPE_COLORS[mark.type] || COLORS.amber}
                stroke="white"
                strokeWidth="0.5"
              />
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-3 justify-center">
          {[
            { key: 'skin_integrity', label: 'Skin', color: '#22c55e' },
            { key: 'injury', label: 'Injury', color: COLORS.red },
            { key: 'pressure_area', label: 'Pressure', color: COLORS.amber },
          ].map((l) => (
            <div key={l.key} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] font-medium text-slate-600">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mark Form Modal */}
      {showMarkForm && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setShowMarkForm(false)}>
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm text-slate-800 mb-3">Add Mark</h3>
            <div className="flex gap-2 mb-3">
              {[
                { key: 'skin_integrity', label: 'Skin' },
                { key: 'injury', label: 'Injury' },
                { key: 'pressure_area', label: 'Pressure' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setMarkType(t.key)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all"
                  style={{
                    background: markType === t.key ? MARK_TYPE_COLORS[t.key] : '#f1f5f9',
                    color: markType === t.key ? 'white' : '#64748b',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={markNote}
              onChange={(e) => setMarkNote(e.target.value)}
              placeholder="Add a note about this mark..."
              className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors mb-3"
              rows={2}
            />
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

      {/* Selected Mark Detail */}
      {selectedMark && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setSelectedMark(null)}>
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full" style={{ background: MARK_TYPE_COLORS[selectedMark.type] }} />
              <h3 className="font-bold text-sm text-slate-800 capitalize">{selectedMark.type.replace('_', ' ')}</h3>
            </div>
            {selectedMark.note && <p className="text-sm text-slate-600 mb-3">{selectedMark.note}</p>}
            <button
              onClick={() => deleteMark(selectedMark.id)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
              style={{ background: COLORS.red }}
            >
              Remove Mark
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

interface FamilyMessage {
  id: string
  senderName: string
  senderRole: string
  message: string
  createdAt: string
}

export default function FamilyPortalScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/family/:id')
  const clientId = params?.id || ''
  const [messages, setMessages] = useState<FamilyMessage[]>([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(`family-messages-${clientId}`)
    if (saved) setMessages(JSON.parse(saved))
  }, [clientId])

  const sendMessage = () => {
    if (!newMessage.trim()) return
    const msg: FamilyMessage = {
      id: 'fm-' + Date.now(),
      senderName: 'Family',
      senderRole: 'family',
      message: newMessage.trim(),
      createdAt: new Date().toISOString(),
    }
    const updated = [msg, ...messages]
    setMessages(updated)
    localStorage.setItem(`family-messages-${clientId}`, JSON.stringify(updated))
    setNewMessage('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Family Portal</h1>
        <p className="text-white/50 text-sm">Updates and messages</p>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto flex flex-col gap-3">
        {/* Visit summary card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-2">Latest Visit</h3>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.08)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Visit completed</div>
              <div className="text-[10px] text-slate-500">Today · 2h duration</div>
            </div>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            All medications administered, vitals recorded, and tasks completed successfully. No incidents reported.
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Messages</h3>
          <div className="flex-1 flex flex-col gap-2 overflow-auto mb-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-4">No messages yet</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-xl p-2.5 ${m.senderRole === 'family' ? 'bg-teal-50 self-end' : 'bg-slate-50 self-start'} max-w-[85%]`}>
                <div className="text-[10px] font-semibold text-slate-500 mb-0.5">{m.senderName}</div>
                <div className="text-xs text-slate-700">{m.message}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

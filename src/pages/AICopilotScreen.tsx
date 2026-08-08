import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'wouter'
import { chatWithAI, getCopilotContext } from '../api/client'
import { enqueue } from '../utils/offlineQueue'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

interface Message {
  role: 'user' | 'ai'
  text: string
  timestamp: Date
  pending?: boolean
}

const QUICK_ACTIONS = [
  'What are my tasks today?',
  'Who are my assigned clients?',
  'Show care plan highlights',
  'When is my next visit?',
  'Any safety flags I should know?',
]

const MAX_MESSAGE_LENGTH = 500

function formatContextSummary(ctx: any) {
  if (!ctx) return 'General care context.'
  const parts = [
    `User: ${ctx.user?.name} (${ctx.user?.role})`,
    `Today: ${ctx.today}`,
    `${ctx.clients?.length || 0} client(s) assigned`,
    `${ctx.tasks?.length || 0} task(s)`,
    `${ctx.scheduledVisits?.length || 0} visit(s) scheduled`,
  ]
  return parts.join(' | ')
}

export default function AICopilotScreen() {
  const [, setLocation] = useLocation()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hello, I'm CAREi. Ask me about your clients, visits, tasks, or care plans.", timestamp: new Date() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [context, setContext] = useState<any>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    getCopilotContext()
      .then((data) => {
        setContext(data)
        setMessages((prev) => {
          if (prev.length === 1 && prev[0].role === 'ai') {
            return [
              {
                role: 'ai',
                text: `Hello, I'm CAREi. I can see you have ${data.clients?.length || 0} client(s), ${data.tasks?.length || 0} task(s), and ${data.scheduledVisits?.length || 0} visit(s) today. Ask me anything about your clients or care tasks.`,
                timestamp: new Date(),
              },
            ]
          }
          return prev
        })
      })
      .catch(() => {
        // Context is optional; the chat can fall back to a simpler prompt.
      })
      .finally(() => setContextLoading(false))
  }, [])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters so I can answer safely.`, timestamp: new Date() },
      ])
      return
    }
    const userMsg: Message = { role: 'user', text: trimmed, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    if (!navigator.onLine) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "You are currently offline. Your question has been queued and will be sent when you are back in signal.", timestamp: new Date(), pending: true },
      ])
      await enqueue({ type: 'ai-copilot', payload: { text: userMsg.text, context: formatContextSummary(context) } })
      return
    }

    setLoading(true)
    try {
      const history = messages
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const data = await chatWithAI(trimmed, context, history.slice(-6))
      const aiMsg: Message = { role: 'ai', text: data.reply || 'No response from AI.', timestamp: new Date() }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const errMsg: Message = { role: 'ai', text: "Sorry, I couldn't process that right now. Please check your connection and try again.", timestamp: new Date() }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Voice input is not supported in this browser. Please type your question.', timestamp: new Date() },
      ])
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript
      }
      setInput(txt)
    }
    rec.onend = () => setIsRecording(false)
    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div
        className="px-4 py-4 text-white shrink-0 flex items-center justify-between"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <button
          onClick={() => setLocation('/dashboard')}
          className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer py-1 px-1 -ml-1 rounded-lg"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-sm block">CAREi Copilot</span>
            {contextLoading ? (
              <span className="text-[10px] text-white/50">Loading your care context…</span>
            ) : context ? (
              <span className="text-[10px] text-white/50">{context.clients?.length || 0} clients · {context.tasks?.length || 0} tasks</span>
            ) : null}
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Quick actions */}
      {!loading && (
        <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs border bg-slate-50 hover:bg-teal-50 hover:border-teal-200 transition-colors cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#334155' }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: msg.role === 'user' ? COLORS.teal : msg.pending ? 'rgba(246,183,60,0.08)' : 'white',
                color: msg.role === 'user' ? COLORS.darkNavy : msg.pending ? COLORS.amber : '#475569',
                border: msg.role === 'user' ? 'none' : msg.pending ? `1px solid ${COLORS.amber}30` : '1px solid rgba(0,0,0,0.06)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : undefined,
                borderBottomLeftRadius: msg.role === 'ai' ? '4px' : undefined,
              }}
            >
              {msg.pending && (
                <span className="inline-flex items-center gap-1 mr-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0">
        <p className="text-[10px] text-slate-400 text-center mb-2 leading-tight">
          CAREi Copilot is an AI assistant, not a medical professional. Always verify clinical or care-critical information with your supervisor.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={isRecording ? stopVoice : startVoice}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer border-none touch-target"
            style={{ background: isRecording ? COLORS.red : 'rgba(79,209,197,0.1)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? 'white' : COLORS.teal} strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask CAREi anything..."
            aria-label="Ask CAREi anything"
            className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm outline-none border-none focus:ring-2 focus:ring-teal/30"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer border-none disabled:opacity-40 touch-target"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

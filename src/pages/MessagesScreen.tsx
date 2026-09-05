import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getConversations,
  getMessages,
  getContacts,
  sendMessage,
} from '../api/client'
import { getToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
  lavender: '#A78BFA',
  g2: '#94A3B8',
}

interface Conversation {
  id: string
  otherId: string
  otherName: string
  otherRole?: string
  lastMessage?: string
  lastMessageAt?: string
  unread: number
}

interface Message {
  id: string
  senderId: string
  senderName: string
  senderRole?: string
  body: string
  priority?: string
  readAt?: string
  createdAt: string
}

interface Contact {
  id: string
  name: string
  role?: string
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function MessagesScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const basePath = slug ? `/tenant/${slug}` : ''

  const loadConversations = useCallback(async () => {
    try {
      const data: any = await getConversations()
      setConversations(data?.conversations || [])
    } catch { /* ignore */ }
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const data: any = await getMessages(conversationId)
      setMessages(data?.messages || [])
      // Refresh conversations to update unread counts
      loadConversations()
    } catch { /* ignore */ }
  }, [loadConversations])

  useEffect(() => {
    (async () => {
      let token = getToken()
      if (!token) {
        token = await secureGet('token')
      }
      if (!token) {
        setLocation('/login?redirect=/messages')
        return
      }
      // Decode user ID from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserId(payload.sub || payload.userId || '')
      } catch {}

      await loadConversations()
      setLoading(false)
    })()

    // Poll for new messages every 15 seconds
    pollRef.current = setInterval(() => {
      loadConversations()
      if (activeConversation) {
        loadMessages(activeConversation.id)
      }
    }, 15000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id)
    }
  }, [activeConversation?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!draft.trim() || !activeConversation) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      await sendMessage(activeConversation.otherId, body)
      await loadMessages(activeConversation.id)
    } catch {
      alert('Failed to send message')
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  async function startNewChat(contact: Contact) {
    // Check if conversation already exists
    const existing = conversations.find((c) => c.otherId === contact.id)
    if (existing) {
      setActiveConversation(existing)
    } else {
      setActiveConversation({
        id: '',
        otherId: contact.id,
        otherName: contact.name,
        otherRole: contact.role,
        lastMessage: '',
        unread: 0,
      })
      setMessages([])
    }
    setShowNewChat(false)
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setLocation(`${basePath}/dashboard`)}
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <button
            onClick={async () => {
              try {
                const data: any = await getContacts()
                setContacts(data?.contacts || [])
              } catch {}
              setShowNewChat(true)
            }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: 'white' }}
          >
            + New Chat
          </button>
        </div>
        <h1 className="font-serif text-lg font-bold">Messages</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List (hidden on mobile when a chat is open) */}
        <div className={`w-full sm:w-80 border-r border-slate-100 bg-white overflow-auto ${activeConversation ? 'hidden sm:block' : ''}`}>
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(79,209,197,0.08)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="text-sm font-medium text-slate-500 mb-1">No conversations yet</div>
              <div className="text-xs text-slate-400">Start a new chat to message a colleague</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors border-none bg-transparent cursor-pointer"
                  style={activeConversation?.id === conv.id ? { background: 'rgba(79,209,197,0.04)' } : {}}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal }}>
                      {getInitials(conv.otherName)}
                    </div>
                    {conv.unread > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: COLORS.red }}>
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 truncate">{conv.otherName}</span>
                      {conv.lastMessageAt && (
                        <span className="text-[9px] text-slate-400 shrink-0 ml-1">{formatTime(conv.lastMessageAt)}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {conv.lastMessage || 'No messages yet'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat View */}
        {activeConversation ? (
          <div className="flex-1 flex flex-col bg-slate-50">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shrink-0">
              <button
                onClick={() => setActiveConversation(null)}
                className="sm:hidden text-slate-400 bg-transparent border-none cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal }}>
                {getInitials(activeConversation.otherName)}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-700">{activeConversation.otherName}</div>
                {activeConversation.otherRole && (
                  <div className="text-[10px] text-slate-400 capitalize">{activeConversation.otherRole}</div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
              {messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.senderId === currentUserId
                  const showSender = i === 0 || messages[i - 1].senderId !== msg.senderId
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showSender && !isMe && (
                          <div className="text-[9px] text-slate-400 mb-0.5 ml-1">{msg.senderName}</div>
                        )}
                        <div
                          className="rounded-2xl px-3 py-2 text-sm"
                          style={
                            isMe
                              ? { background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: 'white', borderBottomRightRadius: '4px' }
                              : { background: 'white', color: '#334155', borderBottomLeftRadius: '4px', border: '1px solid rgba(0,0,0,0.05)' }
                          }
                        >
                          {msg.priority === 'urgent' && (
                            <div className="flex items-center gap-1 mb-1 text-[10px] font-bold" style={{ color: isMe ? 'rgba(255,255,255,0.8)' : COLORS.red }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              URGENT
                            </div>
                          )}
                          {msg.body}
                        </div>
                        <div className="text-[9px] text-slate-300 mt-0.5 mx-1">
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 bg-white border-t border-slate-100 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none"
                  placeholder="Type a message..."
                  style={{ minHeight: '40px', maxHeight: '100px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden sm:flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(79,209,197,0.06)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="text-sm font-medium text-slate-400">Select a conversation to start chatting</div>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewChat(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">New Chat</h3>
              <button onClick={() => setShowNewChat(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all mb-3"
                placeholder="Search contacts..."
              />
              <div className="space-y-1">
                {filteredContacts.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-4">No contacts found</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => startNewChat(contact)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors border-none bg-transparent cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal }}>
                        {getInitials(contact.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-700">{contact.name}</div>
                        {contact.role && <div className="text-[10px] text-slate-400 capitalize">{contact.role}</div>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

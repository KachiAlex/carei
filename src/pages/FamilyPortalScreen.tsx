import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { getClient, getFamilyVisits } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

interface FamilyMessage {
  id: string
  senderName: string
  senderRole: string
  message: string
  createdAt: string
}

interface TaskItem {
  id: string
  text: string
  completed: boolean
  category: string
}

// Phase 6: Condition-specific task lists per document
const CONDITION_TASKS: Record<string, { title: string; icon: string; tasks: string[] }> = {
  'Stroke': {
    title: 'Stroke Recovery Tasks',
    icon: '🧠',
    tasks: [
      'Encourage regular movement exercises',
      'Monitor speech clarity',
      'Check for signs of fatigue',
      'Ensure medication adherence',
      'Assist with mobility safely',
      'Monitor mood changes',
      'Document any new symptoms',
    ],
  },
  'Diabetes': {
    title: 'Diabetes Management Tasks',
    icon: '🩸',
    tasks: [
      'Monitor blood glucose levels',
      'Ensure meals are balanced',
      'Check for signs of hypo/hyperglycemia',
      'Encourage hydration',
      'Monitor foot health',
      'Medication timing adherence',
      'Record any dizziness or confusion',
    ],
  },
  'Dementia': {
    title: 'Dementia Care Tasks',
    icon: '💭',
    tasks: [
      'Use familiar routines',
      'Provide reassurance and validation',
      'Monitor for sundowning',
      'Engage in meaningful activities',
      'Check nutrition intake',
      'Observe behavioural changes',
      'Ensure safe environment',
    ],
  },
}

export default function FamilyPortalScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/family/:id')
  const clientId = params?.id || ''
  const [messages, setMessages] = useState<FamilyMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'messages'>('overview')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [client, setClient] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const clientCondition = client?.condition || 'General'

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getClient(clientId)
      .then((data) => { setClient(data) })
      .catch(() => { setClient(null) })

    getFamilyVisits(clientId)
      .then((data) => { setVisits(data.visits || []) })
      .catch(() => { setVisits([]) })
      .finally(() => { setLoading(false) })

    const saved = localStorage.getItem(`family-messages-${clientId}`)
    if (saved) setMessages(JSON.parse(saved))

    const savedTasks = localStorage.getItem(`family-tasks-${clientId}`)
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks))
    }
  }, [clientId])

  const saveTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks)
    localStorage.setItem(`family-tasks-${clientId}`, JSON.stringify(newTasks))
  }

  const toggleTask = (id: string) => {
    saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

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

  const completedCount = tasks.filter(t => t.completed).length
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0

  // Find matching condition tasks
  const conditionMatch = Object.keys(CONDITION_TASKS).find(c => 
    clientCondition.toLowerCase().includes(c.toLowerCase())
  ) || 'Dementia'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">Family Portal</span>
        </div>
        
        {client && (
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">{'👤'}</div>
            <div>
              <h1 className="font-serif text-lg font-bold">{client.name}</h1>
              <p className="text-white/50 text-sm">{client.age ? `${client.age} years` : ''}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white">
        {[
          { key: 'overview', label: 'Overview', icon: '🏠' },
          { key: 'tasks', label: 'Care Tasks', icon: '✓' },
          { key: 'messages', label: 'Messages', icon: '💬' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex-1 py-3 text-sm font-medium cursor-pointer border-b-2 transition-all"
            style={{
              borderColor: activeTab === tab.key ? COLORS.teal : 'transparent',
              color: activeTab === tab.key ? COLORS.teal : '#64748b',
              background: activeTab === tab.key ? 'rgba(79,209,197,0.04)' : 'white',
            }}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            {/* Visit Summary Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800">Latest Visit</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Completed</span>
              </div>
              {visits.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.08)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{visits[0].carerName || 'Carer'}</div>
                      <div className="text-[10px] text-slate-500">{visits[0].submittedAt ? new Date(visits[0].submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}</div>
                    </div>
                  </div>
                  {visits[0].handoverNote ? (
                    <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3">
                      {visits[0].handoverNote}
                    </div>
                  ) : visits[0].notes ? (
                    <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3">
                      {visits[0].notes}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3">
                      Visit completed. No detailed notes recorded.
                    </div>
                  )}
                  {visits[0].mood && (
                    <div className="mt-2 text-[10px] text-slate-400">Mood: {visits[0].mood}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.08)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">Last Visit</div>
                      <div className="text-[10px] text-slate-500">No recent visits</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3">
                    No recent visit data available.
                  </div>
                </>
              )}
            </div>

            {/* Medication Schedule */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-3">Today's Medication</h3>
              <div className="flex flex-col gap-2">
                {client?.meds?.slice(0, 3).map((med: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-100">
                        <span className="text-sm">💊</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{med.name} {med.dose}</div>
                        <div className="text-[10px] text-slate-500">Due: {med.dueTime}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Given</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Tasks Done', value: `${completedCount}/${tasks.length}`, color: COLORS.teal },
                { label: 'This Week', value: `${visits.length} visit${visits.length !== 1 ? 's' : ''}`, color: COLORS.lavender },
                { label: 'Next Visit', value: 'Tomorrow', color: COLORS.amber },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tasks Tab - Phase 6: Condition-specific */}
        {activeTab === 'tasks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            {/* Progress Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-slate-800">Care Progress</h3>
                <span className="text-[10px] font-medium text-slate-500">{completedCount}/{tasks.length} completed</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%`, background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-2">{Math.round(progressPercent)}% of care tasks completed</div>
            </div>

            {/* Condition-specific Task List */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{CONDITION_TASKS[conditionMatch].icon}</span>
                <h3 className="font-bold text-sm text-slate-800">{CONDITION_TASKS[conditionMatch].title}</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">Personalized care tasks based on {clientCondition} condition</p>
              
              <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <motion.button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-start gap-3 p-3 rounded-xl text-left cursor-pointer border transition-all"
                    style={{
                      background: task.completed ? 'rgba(34,197,94,0.04)' : 'white',
                      borderColor: task.completed ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <div 
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ 
                        background: task.completed ? '#22c55e' : 'white',
                        border: `2px solid ${task.completed ? '#22c55e' : 'rgba(0,0,0,0.15)'}`,
                      }}
                    >
                      {task.completed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {task.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Care Tips */}
            <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl p-4 border border-teal-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <h3 className="font-bold text-sm text-teal-800">Care Tip</h3>
              </div>
              <p className="text-xs text-teal-700 leading-relaxed">
                For clients with {clientCondition}, maintaining a consistent routine is essential. 
                Small environmental cues (like familiar music or photos) can help reduce anxiety.
              </p>
            </div>
          </motion.div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 h-full">
            {/* Messages List */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col">
              <h3 className="font-bold text-sm text-slate-800 mb-3">Communication Log</h3>
              <div className="flex-1 flex flex-col gap-2 overflow-auto mb-3 max-h-[400px]">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-8">
                    <div className="text-3xl mb-2">💬</div>
                    <div>No messages yet</div>
                    <div className="text-xs mt-1">Start a conversation with the care team</div>
                  </div>
                )}
                {messages.map((m) => (
                  <div 
                    key={m.id} 
                    className={`rounded-xl p-3 max-w-[85%] ${m.senderRole === 'family' ? 'bg-teal-50 self-end border border-teal-100' : 'bg-slate-50 self-start border border-slate-100'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-slate-500">{m.senderName}</span>
                      <span className="text-[9px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-xs text-slate-700">{m.message}</div>
                  </div>
                ))}
              </div>
              
              {/* Message Input */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message to the care team..."
                  className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none border border-slate-100 focus:border-teal transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50 transition-all"
                  style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                >
                  Send
                </button>
              </div>
            </div>

            {/* Quick Messages */}
            <div className="flex flex-wrap gap-2">
              {['How was the visit?', 'Any concerns?', 'Thank you!', 'See you tomorrow'].map((quick) => (
                <button
                  key={quick}
                  onClick={() => { setNewMessage(quick); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] bg-white border border-slate-200 text-slate-600 hover:border-teal hover:text-teal cursor-pointer transition-all"
                >
                  {quick}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

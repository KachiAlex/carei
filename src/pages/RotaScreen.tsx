import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { getSchedule } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
}

interface ScheduleItem {
  id: string
  client_name: string
  visit_date: string
  visit_time: string
  status?: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RotaScreen() {
  const [, setLocation] = useLocation()
  const [weekOffset, setWeekOffset] = useState(0)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSchedule()
      .then((data: any[]) => { setSchedule(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1 + weekOffset * 7)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    return d
  })

  const getVisitsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return schedule.filter((s) => {
      const sDate = s.visit_date ? new Date(s.visit_date).toISOString().split('T')[0] : ''
      return sDate === dateStr
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-lg font-bold">Rota</h1>
          <div className="flex gap-2">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="w-8 h-8 rounded-lg bg-white/10 text-white border-none cursor-pointer flex items-center justify-center">&#8249;</button>
            <button onClick={() => setWeekOffset(0)} className="text-xs text-white/70 bg-transparent border-none cursor-pointer">Today</button>
            <button onClick={() => setWeekOffset((o) => o + 1)} className="w-8 h-8 rounded-lg bg-white/10 text-white border-none cursor-pointer flex items-center justify-center">&#8250;</button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((d, i) => {
            const isToday = d.toISOString().split('T')[0] === today
            const dayVisits = getVisitsForDay(d)
            return (
              <button
                key={i}
                className="flex flex-col items-center py-2 rounded-xl border-none cursor-pointer transition-all"
                style={{
                  background: isToday ? COLORS.teal : 'white',
                  color: isToday ? COLORS.darkNavy : '#64748b',
                }}
              >
                <span className="text-[10px] font-medium">{DAYS[i]}</span>
                <span className="text-sm font-bold">{d.getDate()}</span>
                {dayVisits.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayVisits.slice(0, 3).map((_, j) => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.teal }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <h2 className="text-sm font-bold text-slate-800 mb-2">This Week's Visits</h2>
        {weekDays.flatMap((d) => {
          const visits = getVisitsForDay(d)
          return visits.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">{v.client_name}</div>
                  <div className="text-[10px] text-slate-500">{v.visit_time} · {DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}</div>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>Scheduled</span>
              </div>
            </div>
          ))
        })}
      </div>
    </div>
  )
}

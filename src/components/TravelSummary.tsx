import { useState, useEffect, useMemo } from 'react'
import { batchEstimateTravel, getTravelLogs } from '../api/client'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
  g2: '#94A3B8',
}

interface VisitWithClient {
  id: string
  clientId?: string
  clientName?: string
  time?: string
  status?: string
}

interface AssignedClient {
  id: string
  name?: string
  address?: string
}

interface TravelLeg {
  from: string
  to: string
  estimated: boolean
  distanceMeters?: number
  travelTimeSeconds?: number
  distanceMiles?: number
  travelTimeMinutes?: number
}

interface TravelTotals {
  distanceMeters: number
  travelTimeSeconds: number
  distanceMiles: number
  travelTimeMinutes: number
}

export function TravelSummary({
  visits,
  assignedClients,
  carerId,
  visitDate,
}: {
  visits: VisitWithClient[]
  assignedClients: AssignedClient[]
  carerId: string
  visitDate: string
}) {
  const [legs, setLegs] = useState<TravelLeg[]>([])
  const [totals, setTotals] = useState<TravelTotals | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort visits by time
  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) => {
      const tA = a.time || ''
      const tB = b.time || ''
      return tA.localeCompare(tB)
    })
  }, [visits])

  // Map client IDs to addresses
  const visitsWithAddresses = useMemo(() => {
    return sortedVisits.map((v) => {
      const client = assignedClients.find((c) => c.id === v.clientId)
      return {
        clientId: v.clientId,
        clientName: v.clientName || client?.name,
        address: client?.address || '',
      }
    }).filter((v) => v.address)
  }, [sortedVisits, assignedClients])

  useEffect(() => {
    if (visitsWithAddresses.length < 2 || !carerId) return
    setLoading(true)
    setError(null)
    batchEstimateTravel(visitsWithAddresses, carerId, visitDate)
      .then((data: any) => {
        setLegs(data?.results || [])
        setTotals(data?.totals || null)
      })
      .catch((err) => {
        setError('Travel estimation unavailable')
      })
      .finally(() => setLoading(false))
  }, [visitsWithAddresses.length, carerId, visitDate])

  if (visitsWithAddresses.length < 2) return null

  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between border-none bg-transparent cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="text-sm font-bold text-slate-700">Travel Today</span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          ) : totals ? (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="font-semibold" style={{ color: COLORS.teal }}>
                {totals.distanceMiles} mi
              </span>
              <span className="font-semibold text-slate-500">
                {totals.travelTimeMinutes} min
              </span>
            </div>
          ) : null}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      {expanded && !loading && (
        <div className="mt-3 space-y-1.5">
          {legs.length === 0 && error ? (
            <div className="text-[11px] text-slate-400 text-center py-2">{error}</div>
          ) : (
            legs.map((leg, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS.teal }} />
                  <div className="w-px h-3 bg-slate-200" />
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS.amber }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-500 truncate">
                    <span className="font-medium text-slate-600">{leg.from}</span>
                    {' → '}
                    <span className="font-medium text-slate-600">{leg.to}</span>
                  </div>
                  {leg.estimated ? (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {leg.distanceMiles} mi · {leg.travelTimeMinutes} min drive
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-0.5">Could not estimate</div>
                  )}
                </div>
              </div>
            ))
          )}
          {totals && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold text-slate-500">Total Travel</span>
              <div className="flex gap-3 text-[10px]">
                <span className="font-bold" style={{ color: COLORS.teal }}>{totals.distanceMiles} miles</span>
                <span className="font-bold text-slate-600">{totals.travelTimeMinutes} min</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TravelHistoryCard({ carerId, visitDate }: { carerId: string; visitDate: string }) {
  const [totals, setTotals] = useState<TravelTotals | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!carerId) return
    getTravelLogs(carerId, visitDate, visitDate)
      .then((data: any) => {
        setTotals(data?.totals || null)
        setLogs(data?.travelLogs || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [carerId, visitDate])

  if (loading) return null
  if (!totals || totals.distanceMeters === 0) return null

  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-xs font-bold text-slate-700">Travel Summary</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="text-lg font-bold" style={{ color: COLORS.teal }}>{totals.distanceMiles}</div>
          <div className="text-[9px] text-slate-400">miles</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-600">{totals.travelTimeMinutes}</div>
          <div className="text-[9px] text-slate-400">minutes</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-600">{logs.length}</div>
          <div className="text-[9px] text-slate-400">legs</div>
        </div>
      </div>
    </div>
  )
}

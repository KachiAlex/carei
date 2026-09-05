import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { getStaffMatches, getClients } from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import { Users, RefreshCw, Star, MapPin, Clock, Award, Languages } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

export default function StaffMatchingScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/staff-matching')

  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let token = getToken()
    if (!token) {
      secureGet('token').then((t) => {
        if (t) { setToken(t); loadClients() }
        else { setLocation('/login') }
      })
    } else {
      loadClients()
    }
  }, [])

  const loadClients = async () => {
    setLoadingClients(true)
    try {
      const res = await getClients() as any
      const list = res.clients || res || []
      setClients(Array.isArray(list) ? list : [])
    } catch (err: any) {
      setError(err.message || 'Failed to load clients')
    } finally {
      setLoadingClients(false)
    }
  }

  const handleMatch = async (clientId: string) => {
    setSelectedClient(clientId)
    setLoading(true)
    setError('')
    setMatches([])
    try {
      const res = await getStaffMatches(clientId) as any
      setMatches(res.matches || [])
    } catch (err: any) {
      setError(err.message || 'Failed to get staff matches')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score: number) => score >= 80 ? COLORS.green : score >= 60 ? COLORS.amber : COLORS.red

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Users className="text-teal" size={28} />
              Staff-Client Matching
            </h1>
            <p className="text-white/70">AI-scored carer matching based on skills, language, continuity, and availability</p>
          </div>
          <button
            onClick={() => setLocation(`/tenant/${params?.slug}/manager`)}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            Back
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Client Selection */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-5 mb-6">
          <label className="text-white/70 text-sm mb-2 block">Select a client to find best-matched carers</label>
          {loadingClients ? (
            <div className="text-white/60">Loading clients...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clients.map((client: any) => (
                <button
                  key={client.id}
                  onClick={() => handleMatch(client.id)}
                  className={`p-4 rounded-lg text-left transition-all ${
                    selectedClient === client.id
                      ? 'bg-teal/20 border-2 border-teal'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className="text-white font-medium">{client.name}</p>
                  {client.conditions && (
                    <p className="text-white/50 text-sm">{client.conditions.join(', ')}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-white">
            <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Top {matches.length} Matches</h3>
            {matches.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 backdrop-blur rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-teal/20 flex items-center justify-center">
                      <span className="text-teal font-bold">{m.carerName?.charAt(0) || '?'}</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{m.carerName}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={14} style={{ color: scoreColor(m.score) }} />
                        <span className="text-sm font-medium" style={{ color: scoreColor(m.score) }}>{m.score}/100</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color: scoreColor(m.score) }}>{m.score}</div>
                    <div className="text-white/40 text-xs">match score</div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  {m.skills && (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Award size={14} className="text-teal" /> {m.skills.join(', ')}
                    </div>
                  )}
                  {m.languages && m.languages.length > 0 && (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Languages size={14} className="text-teal" /> {m.languages.join(', ')}
                    </div>
                  )}
                  {m.proximity && (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <MapPin size={14} className="text-teal" /> {m.proximity}
                    </div>
                  )}
                  {m.continuityVisits !== undefined && (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Clock size={14} className="text-teal" /> {m.continuityVisits} prior visits
                    </div>
                  )}
                </div>

                {/* Reasons */}
                {m.reasons && m.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.reasons.map((reason: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-teal/10 text-teal rounded text-xs">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : selectedClient ? (
          <div className="flex flex-col items-center justify-center h-48 text-white/40">
            <Users size={48} className="mb-4 opacity-50" />
            <p>No matches found for this client</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

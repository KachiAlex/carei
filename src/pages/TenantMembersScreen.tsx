import { useState, useEffect } from 'react'
import { useLocation, useSearch } from 'wouter'
import { motion } from 'framer-motion'
import { useTenant } from '../contexts/TenantContext'

interface Member {
  id: string
  name: string
  email: string
  role: string
  status: string
  joinedAt: string
  avatar: string
}

interface Invite {
  id: string
  code: string
  email: string
  role: string
  expiresAt: string
  used: boolean
  createdAt: string
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function TenantMembersScreen() {
  const [, setLocation] = useLocation()
  const search = useSearch()
  const { currentTenant, isLoading: tenantLoading } = useTenant()
  const currentUserRole = currentTenant?.role
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members')

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('carer')
  const [isCreating, setIsCreating] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Get tenant slug from URL params
  const params = new URLSearchParams(search)
  const tenantSlug = params.get('tenant') || currentTenant?.slug

  useEffect(() => {
    if (tenantLoading || !tenantSlug) return
    fetchMembers()
    fetchInvites()
  }, [tenantLoading, tenantSlug])

  const fetchMembers = async () => {
    const token = localStorage.getItem('carei_token')
    if (!token || !tenantSlug) return

    try {
      const res = await fetch(`${API_URL}/tenants?members=${encodeURIComponent(tenantSlug)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch members')
      const data = await res.json()
      const mapped = (data.members || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: 'active',
        joinedAt: m.joined_at,
        avatar: m.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??',
      }))
      setMembers(mapped)
    } catch (err) {
      console.error('Error fetching members:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInvites = async () => {
    const token = localStorage.getItem('carei_token')
    if (!token || currentUserRole !== 'admin') return

    try {
      const res = await fetch(`${API_URL}/invites?tenantSlug=${tenantSlug}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch invites')
      const data = await res.json()
      setInvites(data.invites || [])
    } catch (err) {
      console.error('Error fetching invites:', err)
    }
  }

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentTenant?.id) return

    setIsCreating(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const token = localStorage.getItem('carei_token')
      const res = await fetch(`${API_URL}/invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create invite')
      }

      const data = await res.json()
      setInviteSuccess(`Invite created! Code: ${data.code}`)
      setInviteEmail('')
      setShowInviteForm(false)
      fetchInvites()
    } catch (err: any) {
      setInviteError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const cancelInvite = async (inviteId: string) => {
    const token = localStorage.getItem('carei_token')
    try {
      const res = await fetch(`${API_URL}/invites?id=${inviteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to cancel invite')
      fetchInvites()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      carer: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      viewer: 'bg-white/10 text-white/60 border-white/20',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[role] || colors.viewer}`}>
        {role}
      </span>
    )
  }

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1120' }}>
        <div className="animate-spin w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => setLocation('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Team Members</h1>
          <div className="w-9" />
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-teal-500/20 text-teal-400'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Members ({members.length})
          </button>
          {currentUserRole === 'admin' && (
            <button
              onClick={() => setActiveTab('invites')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'invites'
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Invites ({invites.length})
            </button>
          )}
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <p>No team members yet</p>
                {currentUserRole === 'admin' && (
                  <button
                    onClick={() => setActiveTab('invites')}
                    className="text-teal-400 text-sm mt-2 hover:underline"
                  >
                    Invite your first member
                  </button>
                )}
              </div>
            ) : (
              members.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-white">
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium truncate">{member.name}</p>
                      {getRoleBadge(member.role)}
                    </div>
                    <p className="text-white/40 text-sm truncate">{member.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      member.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && currentUserRole === 'admin' && (
          <div className="space-y-3">
            {/* Create Invite Button */}
            {!showInviteForm && (
              <button
                onClick={() => setShowInviteForm(true)}
                className="w-full py-3 rounded-xl bg-teal-500/20 text-teal-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-teal-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Invite
              </button>
            )}

            {/* Invite Form */}
            {showInviteForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                onSubmit={createInvite}
                className="bg-white/5 rounded-xl p-4 space-y-4"
              >
                {inviteError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    <p className="text-red-400 text-xs text-center">{inviteError}</p>
                  </div>
                )}
                {inviteSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                    <p className="text-emerald-400 text-xs text-center">{inviteSuccess}</p>
                  </div>
                )}

                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-teal-400 focus:outline-none"
                  >
                    <option value="carer">Carer</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer (Family)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="flex-1 py-2.5 rounded-lg text-white/60 text-sm hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-2.5 rounded-lg bg-teal-500 text-slate-900 font-medium text-sm disabled:opacity-40"
                  >
                    {isCreating ? 'Creating...' : 'Send Invite'}
                  </button>
                </div>
              </motion.form>
            )}

            {/* Invites List */}
            {invites.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <p>No pending invites</p>
              </div>
            ) : (
              invites.map((invite) => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-medium text-sm truncate">{invite.email}</p>
                        {getRoleBadge(invite.role)}
                      </div>
                      <p className="text-white/40 text-xs">
                        Code: <span className="font-mono text-teal-400">{invite.code}</span>
                      </p>
                      <p className="text-white/30 text-xs mt-1">
                        Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => cancelInvite(invite.id)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

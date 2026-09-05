import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { 
  getCurrentFamilyMember,
  getFamilyMembers,
  inviteFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  familyLogout,
  hasPermission,
  FAMILY_PERMISSIONS
} from '../api/familyApi'
import { 
  Settings, 
  Users, 
  Mail, 
  Phone, 
  Shield, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  AlertCircle,
  UserPlus,
  Key
} from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
  green: '#22C55E',
}

export default function FamilySettingsScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/family/settings')
  
  const [familyMember, setFamilyMember] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'members' | 'security' | 'notifications'>('profile')
  
  // Invite member state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    relationship: '',
    role: 'secondary' as 'primary' | 'secondary' | 'limited'
  })
  const [inviteLoading, setInviteLoading] = useState(false)
  
  // Edit member state
  const [editingMember, setEditingMember] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: ''
  })

  // AI Family Update consent
  const [aiUpdateConsent, setAiUpdateConsent] = useState<boolean>(
    familyMember?.aiUpdateConsent ?? false
  )
  const [consentSaving, setConsentSaving] = useState(false)

  useEffect(() => {
    const member = getCurrentFamilyMember()
    if (!member) {
      setLocation('/family/login')
      return
    }
    setFamilyMember(member)
    loadFamilyMembers()
  }, [setLocation])

  const loadFamilyMembers = async () => {
    try {
      // Get the first client ID for this family member
      const members = await getFamilyMembers('current') // This would need to be adjusted based on actual API
      setFamilyMembers(members)
    } catch (err: any) {
      console.error('Failed to load family members:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteForm.name || !inviteForm.email || !inviteForm.relationship) {
      setError('Please fill in all required fields')
      return
    }

    setInviteLoading(true)
    setError('')
    
    try {
      await inviteFamilyMember({
        ...inviteForm,
        clientId: familyMember?.clientId || 'current' // Adjust based on actual data structure
      })
      setSuccess('Invitation sent successfully!')
      setInviteForm({ name: '', email: '', relationship: '', role: 'secondary' })
      setShowInviteForm(false)
      loadFamilyMembers()
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return

    try {
      await updateFamilyMember(editingMember.id, {
        name: editForm.name,
        phoneNumber: editForm.phoneNumber
      })
      setSuccess('Member updated successfully!')
      setEditingMember(null)
      loadFamilyMembers()
    } catch (err: any) {
      setError(err.message || 'Failed to update member')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this family member?')) {
      return
    }

    try {
      await removeFamilyMember(memberId)
      setSuccess('Member removed successfully!')
      loadFamilyMembers()
    } catch (err: any) {
      setError(err.message || 'Failed to remove member')
    }
  }

  const handleLogout = async () => {
    await familyLogout()
    setLocation('/family/login')
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'primary': return 'bg-purple-100 text-purple-800'
      case 'secondary': return 'bg-blue-100 text-blue-800'
      case 'limited': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'primary': return 'Full access - can manage other family members'
      case 'secondary': return 'Enhanced access - can view care plans and tasks'
      case 'limited': return 'Basic access - view visit summaries and messages'
      default: return 'Unknown role'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.darkNavy }}>
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation('/family/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-gray-600" />
                <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4">
          <div className="flex space-x-8">
            {[
              { key: 'profile', label: 'Profile', icon: Users },
              { key: 'members', label: 'Family Members', icon: Users },
              { key: 'notifications', label: 'Notifications', icon: Mail },
              { key: 'security', label: 'Security', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal text-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon size={16} />
                  {tab.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Profile</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      {familyMember?.name}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      {familyMember?.email}
                    </div>
                  </div>
                  
                  {familyMember?.phoneNumber && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        {familyMember.phoneNumber}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(familyMember?.role)}`}>
                        {familyMember?.role}
                      </span>
                      <span className="text-sm text-gray-500">
                        {getRoleDescription(familyMember?.role)}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      {familyMember?.relationship || 'Not specified'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Family Members Tab */}
        {activeTab === 'members' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Family Members</h2>
                  {hasPermission(familyMember, FAMILY_PERMISSIONS.MANAGE_FAMILY_MEMBERS) && (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90"
                    >
                      <UserPlus size={16} />
                      Invite Member
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {familyMembers.length > 0 ? (
                  <div className="space-y-4">
                    {familyMembers.map((member) => (
                      <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal rounded-full flex items-center justify-center">
                              <span className="text-white font-medium">
                                {member.name.split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{member.name}</h3>
                              <p className="text-sm text-gray-500">{member.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                                  {member.role}
                                </span>
                                <span className="text-xs text-gray-500">{member.relationship}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {hasPermission(familyMember, FAMILY_PERMISSIONS.MANAGE_FAMILY_MEMBERS) && member.id !== familyMember?.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingMember(member)
                                    setEditForm({
                                      name: member.name,
                                      phoneNumber: member.phoneNumber || ''
                                    })
                                  }}
                                  className="p-2 text-gray-400 hover:text-gray-600"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="p-2 text-red-400 hover:text-red-600"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No other family members</p>
                    <p className="text-sm text-gray-400 mt-2">Invite family members to collaborate on care</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invite Form Modal */}
            {showInviteForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-lg p-6 w-full max-w-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Family Member</h3>
                  
                  <form onSubmit={handleInviteMember} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                      <input
                        type="text"
                        value={inviteForm.relationship}
                        onChange={(e) => setInviteForm({...inviteForm, relationship: e.target.value})}
                        placeholder="e.g., Spouse, Child, Parent"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm({...inviteForm, role: e.target.value as any})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                      >
                        <option value="limited">Limited Access</option>
                        <option value="secondary">Enhanced Access</option>
                        <option value="primary">Full Access</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {getRoleDescription(inviteForm.role)}
                      </p>
                    </div>
                    
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-red-700 text-sm">{error}</span>
                      </div>
                    )}
                    
                    {success && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-green-700 text-sm">{success}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="flex-1 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
                      >
                        {inviteLoading ? 'Sending...' : 'Send Invitation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteForm(false)
                          setInviteForm({ name: '', email: '', relationship: '', role: 'secondary' })
                          setError('')
                          setSuccess('')
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Edit Member Modal */}
            {editingMember && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-lg p-6 w-full max-w-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Member</h3>
                  
                  <form onSubmit={handleUpdateMember} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={editForm.phoneNumber}
                        onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                      />
                    </div>
                    
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-red-700 text-sm">{error}</span>
                      </div>
                    )}
                    
                    {success && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-green-700 text-sm">{success}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-teal text-white rounded-lg hover:bg-teal/90"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(null)
                          setError('')
                          setSuccess('')
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>

                <div className="space-y-4">
                  {/* AI Family Update Consent */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.1)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">AI-Generated Visit Updates</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Allow AI to generate concise, family-friendly summaries of care visits.
                            These summaries use visit notes but exclude sensitive medical details.
                            You can revoke consent at any time.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setConsentSaving(true)
                          const newVal = !aiUpdateConsent
                          try {
                            await updateFamilyMember(familyMember?.id, { aiUpdateConsent: newVal })
                            setAiUpdateConsent(newVal)
                            setSuccess(newVal ? 'AI updates enabled' : 'AI updates disabled')
                            setTimeout(() => setSuccess(''), 3000)
                          } catch (err: any) {
                            setError(err.message || 'Failed to update consent')
                          } finally {
                            setConsentSaving(false)
                          }
                        }}
                        disabled={consentSaving}
                        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors border-none cursor-pointer disabled:opacity-50"
                        style={{ background: aiUpdateConsent ? COLORS.teal : '#d1d5db' }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                          style={{ transform: aiUpdateConsent ? 'translateX(24px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Visit completion notifications */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.1)' }}>
                          <Check size={20} className="text-teal" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">Visit Completion Alerts</h3>
                          <p className="text-sm text-gray-500">Get notified when a care visit is completed</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Enabled</span>
                    </div>
                  </div>

                  {/* Message notifications */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(246,183,60,0.1)' }}>
                          <Mail size={20} style={{ color: COLORS.amber }} />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">Message Notifications</h3>
                          <p className="text-sm text-gray-500">Receive alerts for new messages from carers</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Enabled</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-700 text-sm">{success}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
                
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key className="text-gray-400" size={20} />
                        <div>
                          <h3 className="font-medium text-gray-900">Change PIN</h3>
                          <p className="text-sm text-gray-500">Update your 6-digit security PIN</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        Change PIN
                      </button>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="text-gray-400" size={20} />
                        <div>
                          <h3 className="font-medium text-gray-900">Email Address</h3>
                          <p className="text-sm text-gray-500">{familyMember?.email}</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        Change Email
                      </button>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Phone className="text-gray-400" size={20} />
                        <div>
                          <h3 className="font-medium text-gray-900">Phone Number</h3>
                          <p className="text-sm text-gray-500">
                            {familyMember?.phoneNumber || 'Not added'}
                          </p>
                        </div>
                      </div>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        {familyMember?.phoneNumber ? 'Update Phone' : 'Add Phone'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Login Activity</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-gray-900">Current Session</p>
                      <p className="text-sm text-gray-500">Active now</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                  </div>
                  
                  {familyMember?.lastLogin && (
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-gray-900">Last Login</p>
                        <p className="text-sm text-gray-500">
                          {new Date(familyMember.lastLogin).toLocaleString()}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Past</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                    <div>
                      <h3 className="font-medium text-red-900">Sign Out</h3>
                      <p className="text-sm text-red-700">Sign out of your account on this device</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

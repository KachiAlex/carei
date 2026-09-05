import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { inviteFamilyMember } from '../api/client'
import { 
  Users, 
  Mail, 
  UserPlus, 
  X, 
  Check, 
  AlertCircle,
  Shield,
  Smartphone,
  Copy,
  Share2
} from 'lucide-react'

interface FamilyMemberInvitationProps {
  clientId: string
  clientName: string
  onSuccess?: () => void
  onClose?: () => void
}

const ROLES = [
  { 
    value: 'limited', 
    label: 'Limited Access', 
    description: 'View visit summaries and send messages only',
    icon: Shield,
    color: 'bg-gray-100 text-gray-700 border-gray-200'
  },
  { 
    value: 'secondary', 
    label: 'Enhanced Access', 
    description: 'View care plans, tasks, schedules, and notifications',
    icon: Users,
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  { 
    value: 'primary', 
    label: 'Full Access', 
    description: 'Manage other family members, approve changes, view detailed reports',
    icon: Shield,
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
]

export default function FamilyMemberInvitation({ 
  clientId, 
  clientName, 
  onSuccess, 
  onClose 
}: FamilyMemberInvitationProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    relationship: '',
    role: 'secondary' as 'primary' | 'secondary' | 'limited',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invitedMember, setInvitedMember] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.relationship) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await inviteFamilyMember({
        name: formData.name,
        email: formData.email,
        relationship: formData.relationship,
        role: formData.role,
        clientId,
      })
      
      setInvitedMember(result)
      setStep('success')
      onSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const generateLoginUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/family/login`
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generateLoginUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const shareData = {
      title: `CAREi Family Access for ${clientName}`,
      text: `You've been invited to access ${clientName}'s care information on CAREi.`,
      url: generateLoginUrl(),
    }
    
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      handleCopyLink()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg w-full mx-auto">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal/10 rounded-full flex items-center justify-center">
            <UserPlus className="text-teal" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invite Family Member</h2>
            <p className="text-sm text-gray-500">{clientName}</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sarah Johnson"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="family@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  They will receive login instructions at this email
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+44 7700 900000"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  For SMS notifications and emergency contact
                </p>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Relationship to Client <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  placeholder="e.g., Daughter, Son, Spouse, Sibling"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                  required
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Level
                </label>
                <div className="space-y-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.role === role.value
                          ? role.color
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={formData.role === role.value}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-sm">{role.label}</p>
                        <p className="text-xs opacity-80">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <AlertCircle size={16} className="text-red-500" />
                  <span className="text-red-700 text-sm">{error}</span>
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Send Invitation
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 sm:p-6 text-center"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-green-600" size={32} />
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Invitation Sent!
            </h3>
            <p className="text-gray-600 mb-6">
              {formData.name} has been invited to access {clientName}'s care information.
              They will receive an email with login instructions.
            </p>

            {/* Temporary PIN display */}
            {invitedMember?.tempPin && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800 font-medium mb-1">Temporary PIN</p>
                <p className="text-2xl font-mono font-bold text-amber-900 tracking-wider">
                  {invitedMember.tempPin}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Share this securely with {formData.name}
                </p>
              </div>
            )}

            {/* Share Options */}
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Share login link with family member:</p>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-green-600" />
                      <span className="text-sm">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span className="text-sm">Copy Link</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-teal text-white hover:bg-teal/90 rounded-lg transition-colors"
                >
                  <Share2 size={16} />
                  <span className="text-sm">Share</span>
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-6 text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Close and Invite Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

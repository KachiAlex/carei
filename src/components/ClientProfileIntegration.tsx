import { useState, useEffect } from 'react'
import { fetchClient } from '../api/client'
import { User, Pill, Activity, AlertTriangle, Clock, Users } from 'lucide-react'

interface ClientProfile {
  id: string
  name: string
  age?: number
  conditions?: string[]
  medications?: { name: string; dose: string; frequency: string }[]
  preferences?: string
  emergencyContact?: string
  carePackage?: {
    hours: number
    type: string
    fundedBy: string
  }
}

interface ClientProfileIntegrationProps {
  clientId: string
  onImportConditions: (conditions: string[]) => void
  onImportMedications: (medications: string[]) => void
  onImportPreferences: (preferences: string[]) => void
}

export default function ClientProfileIntegration({ 
  clientId, 
  onImportConditions, 
  onImportMedications, 
  onImportPreferences 
}: ClientProfileIntegrationProps) {
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadClientProfile()
  }, [clientId])

  const loadClientProfile = async () => {
    try {
      const clientData = await fetchClient(clientId) as any
      setProfile(clientData)
    } catch (error) {
      console.error('Failed to load client profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCarePlanSuggestions = () => {
    if (!profile) return []

    const suggestions = []

    // Generate objectives based on conditions
    if (profile.conditions) {
      profile.conditions.forEach(condition => {
        switch (condition.toLowerCase()) {
          case 'dementia':
            suggestions.push(
              'Provide cognitive stimulation activities',
              'Maintain familiar routines and environment',
              'Monitor for signs of confusion or agitation'
            )
            break
          case 'diabetes':
            suggestions.push(
              'Monitor blood glucose levels regularly',
              'Administer insulin as prescribed',
              'Monitor for signs of hypo/hyperglycemia'
            )
            break
          case 'mobility issues':
            suggestions.push(
              'Assist with mobility and transfers',
              'Implement fall prevention strategies',
              'Encourage gentle exercises as tolerated'
            )
            break
          case 'heart disease':
            suggestions.push(
              'Monitor vital signs (BP, heart rate)',
              'Administer cardiac medications on time',
              'Watch for signs of cardiac distress'
            )
            break
        }
      })
    }

    // Generate objectives based on medications
    if (profile.medications) {
      const highRiskMeds = profile.medications.filter(med => 
        med.name.toLowerCase().includes('insulin') ||
        med.name.toLowerCase().includes('warfarin') ||
        med.name.toLowerCase().includes('digoxin') ||
        med.name.toLowerCase().includes('opioid')
      )

      if (highRiskMeds.length > 0) {
        suggestions.push(
          'Monitor for medication side effects',
          'Administer high-risk medications with double-check',
          'Document effectiveness and adverse reactions'
        )
      }
    }

    // Generate preventive strategies based on age
    if (profile.age && profile.age > 65) {
      suggestions.push(
        'Regular skin integrity checks',
        'Fall prevention assessment',
        'Nutritional monitoring and supplementation',
        'Social engagement activities'
      )
    }

    return [...new Set(suggestions)] // Remove duplicates
  }

  const generateRisks = () => {
    if (!profile) return []

    const risks = []

    // Age-related risks
    if (profile.age && profile.age > 75) {
      risks.push('High fall risk - use mobility aids and supervision')
    }

    // Condition-specific risks
    if (profile.conditions) {
      profile.conditions.forEach(condition => {
        switch (condition.toLowerCase()) {
          case 'dementia':
            risks.push('Wandering risk - secure environment needed')
            risks.push('Agitation risk from overstimulation')
            break
          case 'diabetes':
            risks.push('Hypoglycemia risk - monitor glucose closely')
            risks.push('Foot complications - daily foot checks required')
            break
          case 'epilepsy':
            risks.push('Seizure risk - maintain safe environment')
            break
        }
      })
    }

    // Medication risks
    if (profile.medications) {
      profile.medications.forEach(med => {
        if (med.name.toLowerCase().includes('warfarin')) {
          risks.push('Bleeding risk - monitor for signs of bleeding')
        }
        if (med.name.toLowerCase().includes('opioid')) {
          risks.push('Respiratory depression risk - monitor breathing')
          risks.push('Constipation risk - implement bowel regimen')
        }
        if (med.name.toLowerCase().includes('diuretic')) {
          risks.push('Dehydration risk - monitor fluid intake')
        }
      })
    }

    return [...new Set(risks)]
  }

  const generatePostMedMonitoring = () => {
    if (!profile?.medications) return []

    const monitoring: string[] = []

    profile.medications.forEach(med => {
      const medName = med.name.toLowerCase()
      
      if (medName.includes('insulin')) {
        monitoring.push('Check blood glucose before and 2 hours after insulin')
      }
      if (medName.includes('warfarin')) {
        monitoring.push('Monitor for signs of bleeding or bruising')
      }
      if (medName.includes('digoxin')) {
        monitoring.push('Monitor heart rate and rhythm')
        monitoring.push('Watch for signs of digoxin toxicity')
      }
      if (medName.includes('furosemide') || medName.includes('lasix')) {
        monitoring.push('Monitor blood pressure and electrolytes')
        monitoring.push('Check for signs of dehydration')
      }
      if (medName.includes('opioid')) {
        monitoring.push('Monitor respiratory rate and sedation level')
        monitoring.push('Assess pain relief effectiveness')
      }
    })

    return [...new Set(monitoring)]
  }

  if (loading) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-white/70">
          <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          Loading client profile...
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          Unable to load client profile
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <User size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Client Profile Integration</h3>
            <p className="text-white/50 text-sm">{profile.name} • Age: {profile.age || 'Not specified'}</p>
          </div>
        </div>
        <div className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-white/10">
          {/* Profile Overview */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conditions */}
            {profile.conditions && profile.conditions.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-amber-400" />
                  <h4 className="text-white font-medium text-sm">Conditions</h4>
                </div>
                <div className="space-y-1">
                  {profile.conditions.map((condition, index) => (
                    <div key={index} className="text-white/70 text-sm">{condition}</div>
                  ))}
                </div>
                <button
                  onClick={() => onImportConditions(profile.conditions || [])}
                  className="mt-2 text-xs text-teal hover:text-teal/80 transition-colors"
                >
                  + Import to care plan
                </button>
              </div>
            )}

            {/* Medications */}
            {profile.medications && profile.medications.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Pill size={16} className="text-green-400" />
                  <h4 className="text-white font-medium text-sm">Medications</h4>
                </div>
                <div className="space-y-1">
                  {profile.medications.map((med, index) => (
                    <div key={index} className="text-white/70 text-xs">
                      <div className="font-medium">{med.name}</div>
                      <div className="text-white/50">{med.dose} • {med.frequency}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onImportMedications(profile.medications?.map(m => `${m.name} (${m.dose})`) || [])}
                  className="mt-2 text-xs text-teal hover:text-teal/80 transition-colors"
                >
                  + Import monitoring needs
                </button>
              </div>
            )}

            {/* Care Package */}
            {profile.carePackage && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-blue-400" />
                  <h4 className="text-white font-medium text-sm">Care Package</h4>
                </div>
                <div className="space-y-1 text-white/70 text-sm">
                  <div>{profile.carePackage.hours} hours/week</div>
                  <div>{profile.carePackage.type}</div>
                  <div>Funded by: {profile.carePackage.fundedBy}</div>
                </div>
              </div>
            )}

            {/* Preferences */}
            {profile.preferences && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-purple-400" />
                  <h4 className="text-white font-medium text-sm">Preferences</h4>
                </div>
                <div className="text-white/70 text-sm">{profile.preferences}</div>
                <button
                  onClick={() => onImportPreferences([profile.preferences || ''])}
                  className="mt-2 text-xs text-teal hover:text-teal/80 transition-colors"
                >
                  + Import to objectives
                </button>
              </div>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="border-t border-white/10 p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-teal rounded-full animate-pulse" />
              AI-Powered Suggestions
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Suggested Objectives */}
              <div>
                <h5 className="text-white/70 text-sm font-medium mb-2">Suggested Objectives</h5>
                <div className="space-y-1">
                  {generateCarePlanSuggestions().slice(0, 3).map((suggestion, index) => (
                    <div key={index} className="text-white/60 text-xs p-2 bg-white/5 rounded">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Risks */}
              <div>
                <h5 className="text-white/70 text-sm font-medium mb-2">Identified Risks</h5>
                <div className="space-y-1">
                  {generateRisks().slice(0, 3).map((risk, index) => (
                    <div key={index} className="text-white/60 text-xs p-2 bg-red-500/10 rounded border border-red-500/20">
                      {risk}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Monitoring */}
              <div>
                <h5 className="text-white/70 text-sm font-medium mb-2">Medication Monitoring</h5>
                <div className="space-y-1">
                  {generatePostMedMonitoring().slice(0, 3).map((monitoring, index) => (
                    <div key={index} className="text-white/60 text-xs p-2 bg-green-500/10 rounded border border-green-500/20">
                      {monitoring}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

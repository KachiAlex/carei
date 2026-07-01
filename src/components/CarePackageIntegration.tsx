import { useState, useEffect } from 'react'
import { Clock, DollarSign, Users, FileText, Target, Calendar } from 'lucide-react'

interface CarePackage {
  id: string
  clientId: string
  hoursPerWeek: number
  type: 'basic' | 'intermediate' | 'complex' | 'end-of-life'
  fundedBy: 'nhs' | 'private' | 'local-authority' | 'mixed'
  startDate: string
  reviewDate: string
  services: string[]
  restrictions?: string[]
  goals?: string[]
}

interface CarePackageIntegrationProps {
  clientId: string
  onPackageUpdate: (carePackageData: CarePackage) => void
  onObjectivesGenerated: (objectives: string[]) => void
}

const CARE_PACKAGE_TYPES = {
  basic: {
    name: 'Basic Care',
    typicalHours: 10,
    commonServices: ['Personal care', 'Medication prompts', 'Meal preparation'],
    objectives: [
      'Maintain personal hygiene and dignity',
      'Ensure medication compliance',
      'Provide nutritious meals',
      'Monitor general wellbeing'
    ]
  },
  intermediate: {
    name: 'Intermediate Care',
    typicalHours: 20,
    commonServices: ['Personal care', 'Medication administration', 'Mobility support', 'Social activities'],
    objectives: [
      'Assist with mobility and transfers',
      'Administer medications safely',
      'Promote social engagement',
      'Monitor health changes'
    ]
  },
  complex: {
    name: 'Complex Care',
    typicalHours: 30,
    commonServices: ['Complex medication management', 'Clinical care', 'Specialist interventions', '24/7 monitoring'],
    objectives: [
      'Manage complex medical needs',
      'Provide clinical interventions',
      'Ensure continuous monitoring',
      'Coordinate with healthcare professionals'
    ]
  },
  'end-of-life': {
    name: 'End of Life Care',
    typicalHours: 40,
    commonServices: ['Palliative care', 'Symptom management', 'Emotional support', 'Family support'],
    objectives: [
      'Ensure comfort and dignity',
      'Manage pain and symptoms effectively',
      'Provide emotional and spiritual support',
      'Support family through the process'
    ]
  }
}

export default function CarePackageIntegration({ 
  clientId, 
  onPackageUpdate, 
  onObjectivesGenerated 
}: CarePackageIntegrationProps) {
  const [carePackage, setCarePackage] = useState<CarePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [customHours, setCustomHours] = useState(0)

  useEffect(() => {
    loadCarePackage()
  }, [clientId])

  const loadCarePackage = async () => {
    // Mock data - in real implementation, this would fetch from API
    const mockPackage: CarePackage = {
      id: 'cp-123',
      clientId,
      hoursPerWeek: 15,
      type: 'intermediate',
      fundedBy: 'local-authority',
      startDate: '2024-01-01',
      reviewDate: '2024-07-01',
      services: ['Personal care', 'Medication administration', 'Mobility support'],
      restrictions: ['No heavy lifting', 'Requires 2-person transfer'],
      goals: ['Maintain independence', 'Prevent hospital admissions']
    }
    
    setCarePackage(mockPackage)
    setCustomHours(mockPackage.hoursPerWeek)
    setLoading(false)
  }

  const calculateOptimalObjectives = (pkg: CarePackage) => {
    const baseObjectives = CARE_PACKAGE_TYPES[pkg.type].objectives
    const customObjectives = []

    // Add objectives based on hours
    if (pkg.hoursPerWeek >= 20) {
      customObjectives.push('Provide comprehensive social support')
      customObjectives.push('Coordinate with external healthcare providers')
    }
    if (pkg.hoursPerWeek >= 30) {
      customObjectives.push('Implement advanced clinical monitoring')
      customObjectives.push('Provide 24/7 emergency response capability')
    }

    // Add objectives based on services
    if (pkg.services.includes('Mobility support')) {
      customObjectives.push('Assist with safe mobility and transfers')
      customObjectives.push('Implement fall prevention strategies')
    }
    if (pkg.services.includes('Medication administration')) {
      customObjectives.push('Administer medications with proper documentation')
      customObjectives.push('Monitor for medication side effects')
    }
    if (pkg.services.includes('Social activities')) {
      customObjectives.push('Promote social engagement and mental stimulation')
      customObjectives.push('Facilitate community participation')
    }

    // Add objectives based on funding source
    if (pkg.fundedBy === 'nhs') {
      customObjectives.push('Document all NHS-required outcomes')
      customObjectives.push('Coordinate with NHS healthcare team')
    }

    return [...new Set([...baseObjectives, ...customObjectives])]
  }

  const generateTimeAllocation = (pkg: CarePackage) => {
    const totalHours = pkg.hoursPerWeek
    const allocation = {
      personalCare: 0,
      medication: 0,
      mobility: 0,
      social: 0,
      clinical: 0,
      documentation: 0
    }

    // Base allocation percentages
    switch (pkg.type) {
      case 'basic':
        allocation.personalCare = totalHours * 0.4
        allocation.medication = totalHours * 0.2
        allocation.mobility = totalHours * 0.1
        allocation.social = totalHours * 0.2
        allocation.documentation = totalHours * 0.1
        break
      case 'intermediate':
        allocation.personalCare = totalHours * 0.3
        allocation.medication = totalHours * 0.25
        allocation.mobility = totalHours * 0.2
        allocation.social = totalHours * 0.15
        allocation.documentation = totalHours * 0.1
        break
      case 'complex':
        allocation.personalCare = totalHours * 0.2
        allocation.medication = totalHours * 0.3
        allocation.mobility = totalHours * 0.15
        allocation.clinical = totalHours * 0.25
        allocation.documentation = totalHours * 0.1
        break
      case 'end-of-life':
        allocation.personalCare = totalHours * 0.35
        allocation.medication = totalHours * 0.3
        allocation.clinical = totalHours * 0.25
        allocation.documentation = totalHours * 0.1
        break
    }

    return allocation
  }

  const updateCarePackage = (updates: Partial<CarePackage>) => {
    if (!carePackage) return
    
    const updatedPackage = { ...carePackage, ...updates }
    setCarePackage(updatedPackage)
    onPackageUpdate(updatedPackage)
    
    // Generate new objectives based on updated package
    const objectives = calculateOptimalObjectives(updatedPackage)
    onObjectivesGenerated(objectives)
  }

  const getFundingColor = (funding: string) => {
    switch (funding) {
      case 'nhs': return 'text-blue-400 bg-blue-400/20'
      case 'private': return 'text-green-400 bg-green-400/20'
      case 'local-authority': return 'text-purple-400 bg-purple-400/20'
      case 'mixed': return 'text-amber-400 bg-amber-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-white/70">
          <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          Loading care package details...
        </div>
      </div>
    )
  }

  if (!carePackage) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-amber-400">
          <FileText size={16} />
          No care package found for this client
        </div>
      </div>
    )
  }

  const timeAllocation = generateTimeAllocation(carePackage)

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Care Package Integration</h3>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">
                {carePackage.hoursPerWeek} hours/week • {CARE_PACKAGE_TYPES[carePackage.type].name}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFundingColor(carePackage.fundedBy)}`}>
                {carePackage.fundedBy.replace('-', ' ').toUpperCase()}
              </span>
            </div>
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
          {/* Package Overview */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hours Breakdown */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-blue-400" />
                <h4 className="text-white font-medium text-sm">Hours Allocation</h4>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm">Total Hours:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customHours}
                      onChange={(e) => {
                        const hours = parseInt(e.target.value) || 0
                        setCustomHours(hours)
                        updateCarePackage({ hoursPerWeek: hours })
                      }}
                      className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-center"
                      min="1"
                      max="168"
                    />
                    <span className="text-white/50 text-sm">hrs/week</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {Object.entries(timeAllocation).map(([activity, hours]) => {
                    if (hours === 0) return null
                    const percentage = Math.round((hours / carePackage.hoursPerWeek) * 100)
                    return (
                      <div key={activity} className="flex items-center justify-between text-xs">
                        <span className="text-white/60 capitalize">
                          {activity.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-white/80">
                          {hours.toFixed(1)}h ({percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Package Details */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-green-400" />
                <h4 className="text-white font-medium text-sm">Package Details</h4>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Review Date:</span>
                  <span className="text-white/80 text-sm">
                    {new Date(carePackage.reviewDate).toLocaleDateString()}
                  </span>
                </div>
                
                <div>
                  <span className="text-white/60 text-sm block mb-1">Services:</span>
                  <div className="flex flex-wrap gap-1">
                    {carePackage.services.map((service, index) => (
                      <span key={index} className="px-2 py-1 bg-teal/20 text-teal text-xs rounded">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generated Objectives */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Target size={16} />
                Package-Aligned Objectives
              </h4>
              <button
                onClick={() => {
                  const objectives = calculateOptimalObjectives(carePackage)
                  onObjectivesGenerated(objectives)
                }}
                className="text-xs text-teal hover:text-teal/80 transition-colors"
              >
                Apply to Care Plan
              </button>
            </div>
            
            <div className="space-y-2">
              {calculateOptimalObjectives(carePackage).map((objective, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 flex-shrink-0" />
                  <span className="text-white/70 text-sm">{objective}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Restrictions and Goals */}
          {(carePackage.restrictions?.length || carePackage.goals?.length) && (
            <div className="border-t border-white/10 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {carePackage.restrictions && carePackage.restrictions.length > 0 && (
                  <div>
                    <h5 className="text-white/70 text-sm font-medium mb-2">Restrictions</h5>
                    <div className="space-y-1">
                      {carePackage.restrictions.map((restriction, index) => (
                        <div key={index} className="text-white/60 text-sm p-2 bg-red-500/10 rounded border border-red-500/20">
                          {restriction}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {carePackage.goals && carePackage.goals.length > 0 && (
                  <div>
                    <h5 className="text-white/70 text-sm font-medium mb-2">Package Goals</h5>
                    <div className="space-y-1">
                      {carePackage.goals.map((goal, index) => (
                        <div key={index} className="text-white/60 text-sm p-2 bg-green-500/10 rounded border border-green-500/20">
                          {goal}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

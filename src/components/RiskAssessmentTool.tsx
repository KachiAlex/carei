import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, Shield, Calculator, Info } from 'lucide-react'

interface RiskFactor {
  id: string
  category: 'mobility' | 'medical' | 'cognitive' | 'environmental' | 'medication'
  name: string
  weight: number // 1-5 severity multiplier
  description: string
  mitigation: string
}

interface RiskAssessment {
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: {
    mobility: number
    medical: number
    cognitive: number
    environmental: number
    medication: number
  }
  recommendations: string[]
}

interface RiskAssessmentToolProps {
  clientConditions: string[]
  clientMedications: { name: string; dose: string; frequency: string }[]
  clientAge?: number
  onRiskUpdate: (assessment: RiskAssessment) => void
}

const RISK_FACTORS: RiskFactor[] = [
  // Mobility Risks
  {
    id: 'fall_history',
    category: 'mobility',
    name: 'Previous Falls',
    weight: 4,
    description: 'History of falls within last 6 months',
    mitigation: 'Implement fall prevention protocols, regular mobility assessments'
  },
  {
    id: 'mobility_aids',
    category: 'mobility',
    name: 'Mobility Aid Usage',
    weight: 3,
    description: 'Requires walking aids or wheelchair',
    mitigation: 'Ensure proper aid maintenance, staff training in safe transfers'
  },
  {
    id: 'balance_issues',
    category: 'mobility',
    name: 'Balance Problems',
    weight: 3,
    description: 'Diagnosed balance or gait abnormalities',
    mitigation: 'Physiotherapy referral, home safety modifications'
  },

  // Medical Risks
  {
    id: 'cardiac_condition',
    category: 'medical',
    name: 'Cardiac Issues',
    weight: 5,
    description: 'Heart disease, arrhythmia, or hypertension',
    mitigation: 'Regular vital sign monitoring, emergency protocols in place'
  },
  {
    id: 'respiratory_condition',
    category: 'medical',
    name: 'Respiratory Conditions',
    weight: 4,
    description: 'COPD, asthma, or other respiratory diseases',
    mitigation: 'Monitor oxygen saturation, have emergency inhalers available'
  },
  {
    id: 'diabetes',
    category: 'medical',
    name: 'Diabetes',
    weight: 3,
    description: 'Type 1 or Type 2 diabetes',
    mitigation: 'Regular glucose monitoring, foot care, medication timing'
  },
  {
    id: 'epilepsy',
    category: 'medical',
    name: 'Seizure Disorder',
    weight: 4,
    description: 'Epilepsy or seizure history',
    mitigation: 'Seizure precautions, medication timing, safe environment'
  },

  // Cognitive Risks
  {
    id: 'dementia',
    category: 'cognitive',
    name: 'Dementia',
    weight: 4,
    description: 'Alzheimer\'s or other dementia',
    mitigation: 'Cognitive stimulation, consistent routines, wandering prevention'
  },
  {
    id: 'confusion',
    category: 'cognitive',
    name: 'Confusion/Disorientation',
    weight: 3,
    description: 'Periods of confusion or disorientation',
    mitigation: 'Clear communication, orientation cues, family involvement'
  },
  {
    id: 'behavioral_issues',
    category: 'cognitive',
    name: 'Behavioral Challenges',
    weight: 3,
    description: 'History of agitation or challenging behavior',
    mitigation: 'PBS training, de-escalation techniques, trigger identification'
  },

  // Environmental Risks
  {
    id: 'living_alone',
    category: 'environmental',
    name: 'Living Alone',
    weight: 3,
    description: 'Client lives alone without constant supervision',
    mitigation: 'Regular check-ins, emergency alert system, family notification'
  },
  {
    id: 'home_safety',
    category: 'environmental',
    name: 'Home Safety Issues',
    weight: 2,
    description: 'Environmental hazards in the home',
    mitigation: 'Home safety assessment, modifications, grab bars installation'
  },

  // Medication Risks
  {
    id: 'polypharmacy',
    category: 'medication',
    name: 'Multiple Medications',
    weight: 3,
    description: 'Taking 5 or more different medications',
    mitigation: 'Medication reconciliation, pharmacist review, simplified regimens'
  },
  {
    id: 'high_risk_meds',
    category: 'medication',
    name: 'High-Risk Medications',
    weight: 4,
    description: 'Anticoagulants, insulin, opioids, or other high-risk drugs',
    mitigation: 'Double-check protocols, side effect monitoring, staff training'
  },
  {
    id: 'medication_compliance',
    category: 'medication',
    name: 'Compliance Issues',
    weight: 3,
    description: 'History of missing or refusing medications',
    mitigation: 'Compliance monitoring, simplified schedules, education'
  }
]

export default function RiskAssessmentTool({ 
  clientConditions, 
  clientMedications, 
  clientAge, 
  onRiskUpdate 
}: RiskAssessmentToolProps) {
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set())
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Auto-detect risk factors based on client profile
  useEffect(() => {
    const autoDetected = new Set<string>()

    // Check conditions
    clientConditions.forEach(condition => {
      const normalized = condition.toLowerCase()
      
      if (normalized.includes('dementia') || normalized.includes('alzheimer')) {
        autoDetected.add('dementia')
      }
      if (normalized.includes('diabetes')) {
        autoDetected.add('diabetes')
      }
      if (normalized.includes('heart') || normalized.includes('cardiac') || normalized.includes('hypertension')) {
        autoDetected.add('cardiac_condition')
      }
      if (normalized.includes('copd') || normalized.includes('asthma') || normalized.includes('respiratory')) {
        autoDetected.add('respiratory_condition')
      }
      if (normalized.includes('epilepsy') || normalized.includes('seizure')) {
        autoDetected.add('epilepsy')
      }
      if (normalized.includes('fall')) {
        autoDetected.add('fall_history')
      }
      if (normalized.includes('balance') || normalized.includes('mobility')) {
        autoDetected.add('balance_issues')
      }
    })

    // Check medications
    clientMedications.forEach(med => {
      const medName = med.name.toLowerCase()
      
      if (medName.includes('warfarin') || medName.includes('anticoagulant')) {
        autoDetected.add('high_risk_meds')
      }
      if (medName.includes('insulin')) {
        autoDetected.add('high_risk_meds')
        autoDetected.add('diabetes')
      }
      if (medName.includes('opioid') || medName.includes('morphine') || medName.includes('oxycodone')) {
        autoDetected.add('high_risk_meds')
      }
    })

    // Age-based risks
    if (clientAge && clientAge > 75) {
      autoDetected.add('fall_history') // Higher fall risk with age
    }

    // Polypharmacy check
    if (clientMedications.length >= 5) {
      autoDetected.add('polypharmacy')
    }

    setSelectedFactors(autoDetected)
  }, [clientConditions, clientMedications, clientAge])

  // Calculate risk assessment whenever factors change
  useEffect(() => {
    calculateRiskAssessment()
  }, [selectedFactors])

  const calculateRiskAssessment = () => {
    const categoryScores = {
      mobility: 0,
      medical: 0,
      cognitive: 0,
      environmental: 0,
      medication: 0
    }

    let totalScore = 0
    const activeFactors = RISK_FACTORS.filter(factor => selectedFactors.has(factor.id))

    activeFactors.forEach(factor => {
      const score = factor.weight
      categoryScores[factor.category] += score
      totalScore += score
    })

    // Normalize scores (0-100 scale)
    const maxPossibleScore = RISK_FACTORS.reduce((sum, factor) => sum + factor.weight, 0)
    const normalizedScore = Math.min(100, Math.round((totalScore / maxPossibleScore) * 100))

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (normalizedScore < 25) riskLevel = 'low'
    else if (normalizedScore < 50) riskLevel = 'medium'
    else if (normalizedScore < 75) riskLevel = 'high'
    else riskLevel = 'critical'

    // Generate recommendations
    const recommendations = generateRecommendations(categoryScores, riskLevel)

    const newAssessment: RiskAssessment = {
      overallScore: normalizedScore,
      riskLevel,
      factors: categoryScores,
      recommendations
    }

    setAssessment(newAssessment)
    onRiskUpdate(newAssessment)
  }

  const generateRecommendations = (categoryScores: RiskAssessment['factors'], riskLevel: string) => {
    const recommendations = []

    // Category-specific recommendations
    if (categoryScores.mobility >= 6) {
      recommendations.push('Implement comprehensive fall prevention program')
      recommendations.push('Schedule regular physiotherapy assessments')
    }
    if (categoryScores.medical >= 8) {
      recommendations.push('Establish vital sign monitoring protocol')
      recommendations.push('Ensure emergency response procedures are in place')
    }
    if (categoryScores.cognitive >= 6) {
      recommendations.push('Implement Positive Behaviour Support plan')
      recommendations.push('Provide cognitive stimulation activities')
    }
    if (categoryScores.environmental >= 4) {
      recommendations.push('Conduct home safety assessment')
      recommendations.push('Install emergency alert system')
    }
    if (categoryScores.medication >= 6) {
      recommendations.push('Implement medication double-check system')
      recommendations.push('Schedule regular medication reviews')
    }

    // Risk level recommendations
    switch (riskLevel) {
      case 'critical':
        recommendations.push('Increase supervision level immediately')
        recommendations.push('Schedule urgent multidisciplinary review')
        break
      case 'high':
        recommendations.push('Enhanced monitoring protocols required')
        recommendations.push('Consider additional support services')
        break
      case 'medium':
        recommendations.push('Regular risk assessments recommended')
        recommendations.push('Ensure all staff are aware of risks')
        break
      case 'low':
        recommendations.push('Maintain current safety protocols')
        recommendations.push('Schedule routine reviews')
        break
    }

    return recommendations
  }

  const toggleFactor = (factorId: string) => {
    setSelectedFactors(prev => {
      const next = new Set(prev)
      if (next.has(factorId)) {
        next.delete(factorId)
      } else {
        next.add(factorId)
      }
      return next
    })
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-400/20 border-green-400/30'
      case 'medium': return 'text-amber-400 bg-amber-400/20 border-amber-400/30'
      case 'high': return 'text-orange-400 bg-orange-400/20 border-orange-400/30'
      case 'critical': return 'text-red-400 bg-red-400/20 border-red-400/30'
      default: return 'text-gray-400 bg-gray-400/20 border-gray-400/30'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mobility': return 'text-blue-400'
      case 'medical': return 'text-red-400'
      case 'cognitive': return 'text-purple-400'
      case 'environmental': return 'text-green-400'
      case 'medication': return 'text-amber-400'
      default: return 'text-gray-400'
    }
  }

  if (!assessment) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-white/70">
          <Calculator size={16} />
          Calculating risk assessment...
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
          <Shield size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Risk Assessment Tool</h3>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskLevelColor(assessment.riskLevel)}`}>
                {assessment.riskLevel.toUpperCase()} RISK
              </span>
              <span className="text-white/50 text-sm">Score: {assessment.overallScore}/100</span>
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
          {/* Risk Score Overview */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <TrendingUp size={16} />
                Risk Breakdown
              </h4>
              <div className="text-white/50 text-sm">
                {selectedFactors.size} risk factors identified
              </div>
            </div>
            
            {/* Category Scores */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(assessment.factors).map(([category, score]) => (
                <div key={category} className="text-center">
                  <div className={`text-2xl font-bold ${getCategoryColor(category)}`}>
                    {score}
                  </div>
                  <div className="text-white/50 text-xs capitalize">
                    {category}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Factors */}
          <div className="p-4">
            <h4 className="text-white font-medium mb-3">Risk Factors</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {RISK_FACTORS.map(factor => {
                const isSelected = selectedFactors.has(factor.id)
                const isAutoDetected = clientConditions.some(c => 
                  c.toLowerCase().includes(factor.name.toLowerCase()) ||
                  factor.description.toLowerCase().includes(c.toLowerCase())
                ) || clientMedications.some(m => 
                  factor.description.toLowerCase().includes(m.name.toLowerCase())
                )

                return (
                  <div
                    key={factor.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-teal/10 border-teal/30' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => toggleFactor(factor.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-teal"
                          />
                          <span className={`text-white font-medium text-sm ${getCategoryColor(factor.category)}`}>
                            {factor.name}
                          </span>
                          {isAutoDetected && (
                            <span className="text-xs text-teal bg-teal/20 px-2 py-0.5 rounded">
                              Auto-detected
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-xs mb-1">{factor.description}</p>
                        <p className="text-white/40 text-xs italic">Severity: {factor.weight}/5</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendations */}
          {assessment.recommendations.length > 0 && (
            <div className="border-t border-white/10 p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Info size={16} />
                Recommendations
              </h4>
              <div className="space-y-2">
                {assessment.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 flex-shrink-0" />
                    <span className="text-white/70 text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

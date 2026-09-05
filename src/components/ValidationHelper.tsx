import { Info, AlertTriangle, CheckCircle } from 'lucide-react'

interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  guidance?: string
}

interface ValidationHelperProps {
  field: string
  value: string | string[]
  rules: ValidationRule
  showGuidance?: boolean
}

const FIELD_GUIDANCE = {
  objectives: {
    guidance: "Focus on measurable outcomes that carers can achieve during visits",
    examples: "Examples: 'Administer medication on time', 'Monitor vital signs', 'Provide emotional support'"
  },
  preventive: {
    guidance: "Include proactive strategies to prevent complications and maintain health",
    examples: "Examples: 'Regular repositioning', 'Fall prevention', 'Infection control'"
  },
  risks: {
    guidance: "List specific risks with severity context and mitigation strategies",
    examples: "Examples: 'Falls risk - use mobility aids', 'Medication errors - double-check dosages'"
  },
  postMed: {
    guidance: "Include specific monitoring instructions for each medication",
    examples: "Examples: 'Monitor BP after antihypertensives', 'Check blood glucose with insulin'"
  },
  pbsTriggers: {
    guidance: "Identify specific situations that may cause distress or behavior escalation",
    examples: "Examples: 'Loud noises', 'Changes in routine', 'Physical discomfort'"
  },
  safetyPlan: {
    guidance: "Outline clear steps for escalating and managing unsafe situations",
    examples: "Examples: 'Assess danger level', 'Call for backup', 'Follow emergency protocols'"
  }
}

export function validateField(field: string, value: string | string[], rules: ValidationRule): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  const arrayValue = Array.isArray(value) ? value : value.split('\n').filter(v => v.trim())
  
  // Required validation
  if (rules.required && arrayValue.length === 0) {
    errors.push('This section is required')
  }
  
  // Minimum items validation
  if (rules.min && arrayValue.length < rules.min) {
    if (arrayValue.length === 0) {
      errors.push(`At least ${rules.min} item${rules.min > 1 ? 's' : ''} required`)
    } else {
      warnings.push(`Consider adding ${rules.min - arrayValue.length} more item${rules.min - arrayValue.length > 1 ? 's' : ''} for comprehensive coverage`)
    }
  }
  
  // Maximum items validation
  if (rules.max && arrayValue.length > rules.max) {
    warnings.push(`Consider reducing to ${rules.max} or fewer items for clarity`)
  }
  
  // Pattern validation for individual items
  if (rules.pattern) {
    const invalidItems = arrayValue.filter(item => !rules.pattern!.test(item.trim()))
    if (invalidItems.length > 0) {
      warnings.push(`${invalidItems.length} item${invalidItems.length > 1 ? 's' : ''} may need refinement for clarity`)
    }
  }
  
  // Field-specific validation
  switch (field) {
    case 'objectives':
      const vagueObjectives = arrayValue.filter(item => 
        /^(provide|ensure|maintain|assist)\s+/i.test(item.trim()) && item.length < 20
      )
      if (vagueObjectives.length > 0) {
        warnings.push('Some objectives could be more specific and measurable')
      }
      break
      
    case 'risks':
      const risksWithoutMitigation = arrayValue.filter(item => !item.includes('-') && !item.includes('–'))
      if (risksWithoutMitigation.length > 0) {
        warnings.push('Consider adding mitigation strategies for each risk')
      }
      break
      
    case 'pbsTriggers':
      const vagueTriggers = arrayValue.filter(item => item.length < 10)
      if (vagueTriggers.length > 0) {
        warnings.push('Some triggers could be more specific for better identification')
      }
      break
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export default function ValidationHelper({ field, value, rules, showGuidance = false }: ValidationHelperProps) {
  const validation = validateField(field, value, rules)
  const guidance = FIELD_GUIDANCE[field as keyof typeof FIELD_GUIDANCE]
  
  if (!showGuidance && validation.errors.length === 0 && validation.warnings.length === 0) {
    return null
  }
  
  return (
    <div className="mt-2 space-y-2">
      {/* Guidance */}
      {showGuidance && guidance && (
        <div className="flex gap-2 p-3 bg-blue-50 rounded-lg">
          <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 mb-1">Guidance</p>
            <p className="text-blue-700">{guidance.guidance}</p>
            <p className="text-blue-600 text-xs mt-1 italic">{guidance.examples}</p>
          </div>
        </div>
      )}
      
      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="flex gap-2 p-3 bg-red-50 rounded-lg">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800 mb-1">Required</p>
            {validation.errors.map((error, index) => (
              <p key={index} className="text-red-700">{error}</p>
            ))}
          </div>
        </div>
      )}
      
      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="flex gap-2 p-3 bg-amber-50 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 mb-1">Suggestions</p>
            {validation.warnings.map((warning, index) => (
              <p key={index} className="text-amber-700">{warning}</p>
            ))}
          </div>
        </div>
      )}
      
      {/* Success */}
      {validation.isValid && value && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0) && (
        <div className="flex gap-2 p-3 bg-green-50 rounded-lg">
          <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-green-800">Looking good!</p>
            <p className="text-green-700">This section meets the requirements</p>
          </div>
        </div>
      )}
    </div>
  )
}

export const VALIDATION_RULES: Record<string, ValidationRule> = {
  objectives: {
    required: true,
    min: 3,
    max: 10,
    guidance: "Focus on measurable outcomes"
  },
  preventive: {
    required: true,
    min: 2,
    max: 8,
    guidance: "Include proactive strategies"
  },
  risks: {
    required: true,
    min: 2,
    max: 8,
    guidance: "List specific risks with mitigation"
  },
  postMed: {
    required: false,
    min: 1,
    max: 10,
    guidance: "Include specific monitoring instructions"
  },
  pbsTriggers: {
    required: false,
    min: 1,
    max: 6,
    guidance: "Identify specific triggers"
  },
  safetyPlan: {
    required: true,
    min: 3,
    max: 8,
    guidance: "Outline clear escalation steps"
  }
}

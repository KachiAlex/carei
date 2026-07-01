import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface PBSStateCardProps {
  state: 'calm' | 'anxious' | 'risk'
  signs: string[]
  actions: string[]
  onSignsChange: (signs: string[]) => void
  onActionsChange: (actions: string[]) => void
  suggestions?: {
    signs: string[]
    actions: string[]
  }
}

const STATE_CONFIG = {
  calm: {
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    titleColor: 'text-green-800',
    subtitleColor: 'text-green-600',
    icon: CheckCircle,
    title: 'PBS — Calm State (Green)',
    subtitle: 'Signs and staff actions when client is calm'
  },
  anxious: {
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    titleColor: 'text-amber-800',
    subtitleColor: 'text-amber-600',
    icon: AlertCircle,
    title: 'PBS — Anxious State (Amber)',
    subtitle: 'Warning signs and response actions'
  },
  risk: {
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    titleColor: 'text-red-800',
    subtitleColor: 'text-red-600',
    icon: AlertTriangle,
    title: 'PBS — Risk State (Red)',
    subtitle: 'Risk signs and immediate actions'
  }
}

export default function PBSStateCard({ 
  state, 
  signs, 
  actions, 
  onSignsChange, 
  onActionsChange,
  suggestions = { signs: [], actions: [] }
}: PBSStateCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const config = STATE_CONFIG[state]
  const Icon = config.icon

  return (
    <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl overflow-hidden transition-all`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white bg-opacity-60`}>
            <Icon size={20} className={config.titleColor} />
          </div>
          <div className="text-left">
            <h3 className={`font-bold ${config.titleColor}`}>{config.title}</h3>
            <p className={`text-sm ${config.subtitleColor}`}>{config.subtitle}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className={config.titleColor} size={20} />
        ) : (
          <ChevronDown className={config.titleColor} size={20} />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Signs Section */}
          <div>
            <label className={`block text-sm font-semibold ${config.titleColor} mb-2`}>
              Observable Signs
            </label>
            <div className="bg-white bg-opacity-60 rounded-lg p-3">
              <div className="space-y-2">
                {signs.map((sign, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${config.color}-400`} />
                    <span className="text-sm text-slate-700 flex-1">{sign}</span>
                    <button
                      onClick={() => onSignsChange(signs.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {signs.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No signs added yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div>
            <label className={`block text-sm font-semibold ${config.titleColor} mb-2`}>
              Staff Actions
            </label>
            <div className="bg-white bg-opacity-60 rounded-lg p-3">
              <div className="space-y-2">
                {actions.map((action, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${config.color}-400 mt-1.5`} />
                    <span className="text-sm text-slate-700 flex-1">{action}</span>
                    <button
                      onClick={() => onActionsChange(actions.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {actions.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No actions added yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Add Suggestions */}
          {(suggestions.signs.length > 0 || suggestions.actions.length > 0) && (
            <div className="border-t border-opacity-20 border-slate-300 pt-3">
              <p className={`text-xs font-semibold ${config.titleColor} mb-2`}>Quick Add:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.signs.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={`sign-${index}`}
                    onClick={() => !signs.includes(suggestion) && onSignsChange([...signs, suggestion])}
                    disabled={signs.includes(suggestion)}
                    className="px-2 py-1 text-xs bg-white bg-opacity-60 rounded-full border border-opacity-20 border-slate-300 hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    + {suggestion}
                  </button>
                ))}
                {suggestions.actions.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={`action-${index}`}
                    onClick={() => !actions.includes(suggestion) && onActionsChange([...actions, suggestion])}
                    disabled={actions.includes(suggestion)}
                    className="px-2 py-1 text-xs bg-white bg-opacity-60 rounded-full border border-opacity-20 border-slate-300 hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

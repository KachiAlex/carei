import { useState, useEffect } from 'react'
import { History, GitBranch, User, Clock, ArrowRight, Eye, RotateCcw } from 'lucide-react'

interface ChangeRecord {
  id: string
  version: number
  timestamp: Date
  userId: string
  userName: string
  userRole: string
  changes: {
    section: string
    field: string
    oldValue: any
    newValue: any
    type: 'add' | 'remove' | 'modify'
  }[]
  summary: string
  published: boolean
}

interface ChangeTrackingProps {
  carePlanId: string
  currentVersion: number
  onVersionRestore: (version: number) => void
  onVersionCompare: (version1: number, version2: number) => void
}

export default function ChangeTracking({ 
  carePlanId, 
  currentVersion, 
  onVersionRestore, 
  onVersionCompare 
}: ChangeTrackingProps) {
  const [history, setHistory] = useState<ChangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null)

  useEffect(() => {
    loadChangeHistory()
  }, [carePlanId])

  const loadChangeHistory = async () => {
    // Mock data - in real implementation, this would fetch from API
    const mockHistory: ChangeRecord[] = [
      {
        id: 'change-1',
        version: 3,
        timestamp: new Date(Date.now() - 300000),
        userId: 'user-1',
        userName: 'Sarah Johnson',
        userRole: 'manager',
        changes: [
          {
            section: 'risks',
            field: 'items',
            oldValue: ['Fall risk - use mobility aids'],
            newValue: ['Fall risk - use mobility aids', 'Medication error risk - double-check dosages'],
            type: 'add'
          },
          {
            section: 'objectives',
            field: 'items',
            oldValue: ['Maintain personal hygiene'],
            newValue: ['Maintain personal hygiene and dignity'],
            type: 'modify'
          }
        ],
        summary: 'Updated risk assessment and refined care objectives',
        published: false
      },
      {
        id: 'change-2',
        version: 2,
        timestamp: new Date(Date.now() - 3600000),
        userId: 'user-2',
        userName: 'Mike Chen',
        userRole: 'nurse',
        changes: [
          {
            section: 'postMed',
            field: 'items',
            oldValue: [],
            newValue: ['Monitor BP after antihypertensives', 'Check blood glucose with insulin'],
            type: 'add'
          }
        ],
        summary: 'Added post-medication monitoring protocols',
        published: true
      },
      {
        id: 'change-3',
        version: 1,
        timestamp: new Date(Date.now() - 7200000),
        userId: 'user-1',
        userName: 'Sarah Johnson',
        userRole: 'manager',
        changes: [
          {
            section: 'objectives',
            field: 'items',
            oldValue: [],
            newValue: ['Maintain personal hygiene', 'Administer medication on time'],
            type: 'add'
          }
        ],
        summary: 'Initial care plan created',
        published: true
      }
    ]
    
    setHistory(mockHistory.sort((a, b) => b.version - a.version))
    setLoading(false)
  }

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    return `${Math.floor(hours / 24)} days ago`
  }

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'add': return 'text-green-400 bg-green-400/20'
      case 'remove': return 'text-red-400 bg-red-400/20'
      case 'modify': return 'text-amber-400 bg-amber-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'add': return '+'
      case 'remove': return '-'
      case 'modify': return '~'
      default: return '•'
    }
  }

  const handleVersionSelect = (version: number) => {
    if (compareMode) {
      if (compareVersions === null) {
        setCompareVersions([version, version])
      } else if (compareVersions[0] === version) {
        setCompareVersions(null)
        setCompareMode(false)
      } else {
        setCompareVersions([compareVersions[0], version])
        onVersionCompare(compareVersions[0], version)
        setCompareMode(false)
        setCompareVersions(null)
      }
    } else {
      setSelectedVersion(version === selectedVersion ? null : version)
    }
  }

  const handleRestore = (version: number) => {
    if (window.confirm(`Are you sure you want to restore to version ${version}? This will create a new version based on the selected one.`)) {
      onVersionRestore(version)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-blue-500'
      case 'nurse': return 'bg-green-500'
      case 'carer': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-white/70">
          <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          Loading change history...
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
          <History size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Change Tracking</h3>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">
                Version {currentVersion} • {history.length} changes
              </span>
              {history.filter(h => !h.published).length > 0 && (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                  {history.filter(h => !h.published).length} draft{history.filter(h => !h.published).length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`p-2 rounded-lg transition-colors ${
              compareMode 
                ? 'bg-teal/20 text-teal' 
                : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
            title="Compare versions"
          >
            <GitBranch size={16} />
          </button>
          <div className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-white/10">
          {/* Compare Mode Banner */}
          {compareMode && (
            <div className="p-3 bg-teal/10 border-b border-teal/30">
              <div className="flex items-center justify-between">
                <span className="text-teal text-sm">
                  {compareVersions 
                    ? `Comparing versions ${compareVersions[0]} and ${compareVersions[1]}`
                    : 'Select two versions to compare'
                  }
                </span>
                <button
                  onClick={() => {
                    setCompareMode(false)
                    setCompareVersions(null)
                  }}
                  className="text-teal/70 hover:text-teal text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Version History */}
          <div className="p-4">
            <div className="space-y-3">
              {history.map((record, index) => {
                const isSelected = selectedVersion === record.version
                const isBeingCompared = compareVersions?.includes(record.version)
                
                return (
                  <div
                    key={record.id}
                    className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-teal/10 border-teal/30' 
                        : isBeingCompared
                        ? 'bg-amber/10 border-amber/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => handleVersionSelect(record.version)}
                  >
                    {/* Version Header */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">v{record.version}</span>
                            {record.version === currentVersion && (
                              <span className="px-2 py-1 bg-teal/20 text-teal text-xs rounded">
                                Current
                              </span>
                            )}
                            {record.published && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                Published
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${getRoleColor(record.userRole)} flex items-center justify-center text-white text-xs`}>
                              {record.userName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-white/70 text-sm">{record.userName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-xs">{formatTimeAgo(record.timestamp)}</span>
                          <div className="flex gap-1">
                            {record.version !== currentVersion && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestore(record.version)
                                }}
                                className="p-1 text-white/40 hover:text-white/60 transition-colors"
                                title="Restore this version"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // View version details
                              }}
                              className="p-1 text-white/40 hover:text-white/60 transition-colors"
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-white/70 text-sm mb-2">{record.summary}</p>
                      
                      {/* Changes Summary */}
                      <div className="flex flex-wrap gap-1">
                        {record.changes.slice(0, 3).map((change, changeIndex) => (
                          <span
                            key={changeIndex}
                            className={`px-2 py-1 rounded text-xs ${getChangeTypeColor(change.type)}`}
                          >
                            {getChangeTypeIcon(change.type)} {change.section}
                          </span>
                        ))}
                        {record.changes.length > 3 && (
                          <span className="px-2 py-1 rounded text-xs bg-white/10 text-white/60">
                            +{record.changes.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed Changes (when selected) */}
                    {isSelected && (
                      <div className="border-t border-white/10 p-3 bg-black/20">
                        <h5 className="text-white font-medium mb-3">Detailed Changes</h5>
                        <div className="space-y-3">
                          {record.changes.map((change, changeIndex) => (
                            <div key={changeIndex} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs ${getChangeTypeColor(change.type)}`}>
                                  {getChangeTypeIcon(change.type)} {change.type}
                                </span>
                                <span className="text-white/70 text-sm">{change.section}.{change.field}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {change.oldValue !== undefined && (
                                  <div>
                                    <span className="text-red-400 text-xs">Before:</span>
                                    <div className="text-white/60 mt-1 p-2 bg-red-500/10 rounded border border-red-500/20">
                                      {Array.isArray(change.oldValue) 
                                        ? change.oldValue.join(', ') 
                                        : JSON.stringify(change.oldValue)
                                      }
                                    </div>
                                  </div>
                                )}
                                {change.newValue !== undefined && (
                                  <div>
                                    <span className="text-green-400 text-xs">After:</span>
                                    <div className="text-white/60 mt-1 p-2 bg-green-500/10 rounded border border-green-500/20">
                                      {Array.isArray(change.newValue) 
                                        ? change.newValue.join(', ') 
                                        : JSON.stringify(change.newValue)
                                      }
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertCircle, Users, Send, FileText, Calendar, MessageSquare } from 'lucide-react'

interface ApprovalStep {
  id: string
  name: string
  role: 'manager' | 'nurse' | 'family' | 'external'
  required: boolean
  status: 'pending' | 'approved' | 'rejected' | 'skipped'
  assignedTo?: {
    id: string
    name: string
    email: string
  }
  completedAt?: Date
  comments?: string
}

interface ApprovalWorkflow {
  id: string
  carePlanId: string
  name: string
  description: string
  steps: ApprovalStep[]
  currentStep: number
  status: 'in-progress' | 'approved' | 'rejected' | 'cancelled'
  createdAt: Date
  completedAt?: Date
  initiator: {
    id: string
    name: string
    role: string
  }
}

interface ApprovalWorkflowProps {
  carePlanId: string
  currentUserId: string
  currentUserRole: string
  onWorkflowStart: (workflowId: string) => void
  onApprovalComplete: (workflowId: string) => void
}

const WORKFLOW_TEMPLATES = {
  standard: {
    name: 'Standard Care Plan Approval',
    description: 'Manager review and approval',
    steps: [
      { role: 'manager' as const, required: true },
    ]
  },
  clinical: {
    name: 'Clinical Care Plan Approval',
    description: 'Manager and clinical review',
    steps: [
      { role: 'manager' as const, required: true },
      { role: 'nurse' as const, required: true },
    ]
  },
  comprehensive: {
    name: 'Comprehensive Care Plan Approval',
    description: 'Multi-stakeholder approval process',
    steps: [
      { role: 'manager' as const, required: true },
      { role: 'nurse' as const, required: true },
      { role: 'family' as const, required: false },
    ]
  },
  external: {
    name: 'External Review Required',
    description: 'Includes external specialist review',
    steps: [
      { role: 'manager' as const, required: true },
      { role: 'nurse' as const, required: true },
      { role: 'external' as const, required: true },
    ]
  }
}

export default function ApprovalWorkflow({ 
  carePlanId, 
  currentUserId, 
  currentUserRole, 
  onWorkflowStart, 
  onApprovalComplete 
}: ApprovalWorkflowProps) {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const [activeWorkflow, setActiveWorkflow] = useState<ApprovalWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showNewWorkflow, setShowNewWorkflow] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof WORKFLOW_TEMPLATES>('standard')
  const [approvalComments, setApprovalComments] = useState('')

  useEffect(() => {
    loadWorkflows()
  }, [carePlanId])

  const loadWorkflows = async () => {
    // Mock data - in real implementation, this would fetch from API
    const mockWorkflows: ApprovalWorkflow[] = [
      {
        id: 'workflow-1',
        carePlanId,
        name: 'Standard Care Plan Approval',
        description: 'Manager review and approval',
        status: 'in-progress',
        currentStep: 0,
        createdAt: new Date(Date.now() - 3600000),
        initiator: {
          id: 'user-1',
          name: 'Sarah Johnson',
          role: 'manager'
        },
        steps: [
          {
            id: 'step-1',
            name: 'Manager Review',
            role: 'manager',
            required: true,
            status: 'pending',
            assignedTo: {
              id: 'user-2',
              name: 'Mike Chen',
              email: 'mike@carei.com'
            }
          }
        ]
      }
    ]
    
    setWorkflows(mockWorkflows)
    const active = mockWorkflows.find(w => w.status === 'in-progress')
    if (active) setActiveWorkflow(active)
    setLoading(false)
  }

  const startNewWorkflow = (templateKey: keyof typeof WORKFLOW_TEMPLATES) => {
    const template = WORKFLOW_TEMPLATES[templateKey]
    const newWorkflow: ApprovalWorkflow = {
      id: `workflow-${Date.now()}`,
      carePlanId,
      name: template.name,
      description: template.description,
      status: 'in-progress',
      currentStep: 0,
      createdAt: new Date(),
      initiator: {
        id: currentUserId,
        name: 'You',
        role: currentUserRole
      },
      steps: template.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        name: `${step.role.charAt(0).toUpperCase() + step.role.slice(1)} Review`,
        role: step.role,
        required: step.required,
        status: 'pending' as const,
        assignedTo: getAssigneeForRole(step.role)
      }))
    }
    
    setWorkflows(prev => [newWorkflow, ...prev])
    setActiveWorkflow(newWorkflow)
    setShowNewWorkflow(false)
    onWorkflowStart(newWorkflow.id)
  }

  const getAssigneeForRole = (role: string) => {
    // Mock assignment logic - in real implementation, this would query the organization structure
    const assignees = {
      manager: { id: 'user-2', name: 'Mike Chen', email: 'mike@carei.com' },
      nurse: { id: 'user-3', name: 'Emma Wilson', email: 'emma@carei.com' },
      family: { id: 'user-4', name: 'John Smith', email: 'john@carei.com' },
      external: { id: 'user-5', name: 'Dr. Sarah Brown', email: 'sarah@external.com' }
    }
    return assignees[role as keyof typeof assignees]
  }

  const handleApproval = (stepId: string, approved: boolean) => {
    if (!activeWorkflow) return
    
    const updatedSteps = activeWorkflow.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          status: (approved ? 'approved' : 'rejected') as 'approved' | 'rejected',
          completedAt: new Date(),
          comments: approvalComments
        }
      }
      return step
    })
    
    const updatedWorkflow = {
      ...activeWorkflow,
      steps: updatedSteps,
      currentStep: updatedSteps.findIndex(s => s.status === 'pending' && s.required)
    }
    
    // Check if workflow is complete
    const requiredSteps = updatedSteps.filter(s => s.required)
    const allRequiredApproved = requiredSteps.every(s => s.status === 'approved')
    const hasRejection = updatedSteps.some(s => s.status === 'rejected')
    
    if (allRequiredApproved) {
      updatedWorkflow.status = 'approved'
      updatedWorkflow.completedAt = new Date()
      onApprovalComplete(updatedWorkflow.id)
    } else if (hasRejection) {
      updatedWorkflow.status = 'rejected'
      updatedWorkflow.completedAt = new Date()
    }
    
    setActiveWorkflow(updatedWorkflow)
    setWorkflows(prev => prev.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w))
    setApprovalComments('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400 bg-green-400/20'
      case 'rejected': return 'text-red-400 bg-red-400/20'
      case 'pending': return 'text-amber-400 bg-amber-400/20'
      case 'skipped': return 'text-gray-400 bg-gray-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={16} />
      case 'rejected': return <AlertCircle size={16} />
      case 'pending': return <Clock size={16} />
      default: return <Clock size={16} />
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager': return '👔'
      case 'nurse': return '⚕️'
      case 'family': return '👨‍👩‍👧‍👦'
      case 'external': return '🏥'
      default: return '👤'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-white/70">
          <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          Loading approval workflows...
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
          <CheckCircle size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Approval Workflow</h3>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">
                {activeWorkflow ? activeWorkflow.status : 'No active workflow'}
              </span>
              {activeWorkflow?.status === 'in-progress' && (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                  In Progress
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewWorkflow(!showNewWorkflow)}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Start new workflow"
          >
            <Send size={16} />
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
          {/* New Workflow */}
          {showNewWorkflow && (
            <div className="p-4 border-b border-white/10 bg-teal/10">
              <h4 className="text-white font-medium mb-3">Start New Approval Workflow</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-white/70 text-sm mb-2">Select Workflow Type:</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTemplate(key as keyof typeof WORKFLOW_TEMPLATES)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedTemplate === key
                            ? 'bg-teal/20 border-teal/30 text-white'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-white/50 mt-1">{template.description}</div>
                        <div className="flex gap-1 mt-2">
                          {template.steps.map((step, index) => (
                            <span key={index} className="text-xs">
                              {getRoleIcon(step.role)}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => startNewWorkflow(selectedTemplate)}
                    className="px-4 py-2 bg-teal text-navy rounded font-medium text-sm hover:bg-teal/90 transition-colors"
                  >
                    Start Workflow
                  </button>
                  <button
                    onClick={() => setShowNewWorkflow(false)}
                    className="px-4 py-2 bg-white/10 text-white rounded font-medium text-sm hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Workflow */}
          {activeWorkflow && (
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">{activeWorkflow.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/50 text-sm">
                      Started by {activeWorkflow.initiator.name} • {formatTimeAgo(activeWorkflow.createdAt)}
                    </span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activeWorkflow.status)}`}>
                  {activeWorkflow.status.replace('-', ' ').toUpperCase()}
                </span>
              </div>

              {/* Progress Steps */}
              <div className="space-y-3">
                {activeWorkflow.steps.map((step, index) => {
                  const isCurrent = index === activeWorkflow.currentStep
                  const canApprove = isCurrent && step.assignedTo?.id === currentUserId
                  
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg border ${
                        isCurrent 
                          ? 'bg-teal/10 border-teal/30' 
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            step.status === 'approved' 
                              ? 'bg-green-500 text-white' 
                              : step.status === 'rejected'
                              ? 'bg-red-500 text-white'
                              : 'bg-white/10 text-white/50'
                          }`}>
                            {getRoleIcon(step.role)}
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">{step.name}</div>
                            <div className="text-white/50 text-xs">
                              {step.assignedTo?.name} • {step.required ? 'Required' : 'Optional'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(step.status)}`}>
                            {step.status.toUpperCase()}
                          </span>
                          {getStatusIcon(step.status)}
                        </div>
                      </div>

                      {step.completedAt && (
                        <div className="text-white/40 text-xs mb-2">
                          Completed {formatTimeAgo(step.completedAt)}
                        </div>
                      )}

                      {step.comments && (
                        <div className="text-white/60 text-sm p-2 bg-white/5 rounded">
                          {step.comments}
                        </div>
                      )}

                      {/* Approval Actions */}
                      {canApprove && step.status === 'pending' && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={approvalComments}
                            onChange={(e) => setApprovalComments(e.target.value)}
                            placeholder="Add comments (optional)..."
                            className="w-full p-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm resize-none focus:outline-none focus:border-teal"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproval(step.id, true)}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproval(step.id, false)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Workflow History */}
          <div className="p-4">
            <h4 className="text-white font-medium mb-3">Workflow History</h4>
            <div className="space-y-2">
              {workflows.filter(w => w.status !== 'in-progress').map(workflow => (
                <div key={workflow.id} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm font-medium">{workflow.name}</div>
                      <div className="text-white/50 text-xs">
                        Completed {workflow.completedAt ? formatTimeAgo(workflow.completedAt) : 'N/A'}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(workflow.status)}`}>
                      {workflow.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
              {workflows.filter(w => w.status !== 'in-progress').length === 0 && (
                <div className="text-white/50 text-sm text-center py-4">
                  No completed workflows yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

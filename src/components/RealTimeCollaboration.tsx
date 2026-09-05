import { useState, useEffect, useRef } from 'react'
import { Users, MessageSquare, Edit3, Clock, AlertCircle, Check, X } from 'lucide-react'

interface User {
  id: string
  name: string
  role: 'manager' | 'carer' | 'nurse' | 'family'
  avatar?: string
  isOnline: boolean
  cursor?: {
    section: string
    position: number
  }
}

interface Comment {
  id: string
  userId: string
  userName: string
  section: string
  content: string
  timestamp: Date
  resolved: boolean
  replies?: Comment[]
}

interface EditConflict {
  id: string
  section: string
  userId: string
  userName: string
  theirValue: any
  yourValue: any
  timestamp: Date
}

interface RealTimeCollaborationProps {
  carePlanId: string
  currentUserId: string
  onConflictResolve: (section: string, resolvedValue: any) => void
  onCommentAdd: (comment: Omit<Comment, 'id' | 'timestamp'>) => void
}

export default function RealTimeCollaboration({ 
  carePlanId, 
  currentUserId, 
  onConflictResolve, 
  onCommentAdd 
}: RealTimeCollaborationProps) {
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [conflicts, setConflicts] = useState<EditConflict[]>([])
  const [showChat, setShowChat] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [expanded, setExpanded] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Mock WebSocket connection - in real implementation, connect to actual WebSocket server
  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [carePlanId])

  const connectWebSocket = () => {
    // Mock WebSocket for demonstration
    // In production, this would be: wsRef.current = new WebSocket(`wss://api.carei.com/collaboration/${carePlanId}`)
    
    // Simulate other users joining
    setTimeout(() => {
      setActiveUsers([
        {
          id: 'user-1',
          name: 'Sarah Johnson',
          role: 'manager',
          isOnline: true,
          cursor: { section: 'objectives', position: 2 }
        },
        {
          id: 'user-2',
          name: 'Mike Chen',
          role: 'nurse',
          isOnline: true
        },
        {
          id: currentUserId,
          name: 'You',
          role: 'manager',
          isOnline: true
        }
      ])
    }, 1000)

    // Simulate receiving comments
    setTimeout(() => {
      setComments([
        {
          id: 'comment-1',
          userId: 'user-2',
          userName: 'Mike Chen',
          section: 'risks',
          content: 'Should we add a fall risk assessment? Client had a near miss last week.',
          timestamp: new Date(Date.now() - 300000),
          resolved: false
        }
      ])
    }, 2000)
  }

  const handleWebSocketMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data)
    
    switch (data.type) {
      case 'user_joined':
        setActiveUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user])
        break
      case 'user_left':
        setActiveUsers(prev => prev.filter(u => u.id !== data.userId))
        break
      case 'cursor_update':
        setActiveUsers(prev => prev.map(u => 
          u.id === data.userId ? { ...u, cursor: data.cursor } : u
        ))
        break
      case 'comment_added':
        setComments(prev => [...prev, data.comment])
        break
      case 'edit_conflict':
        setConflicts(prev => [...prev, data.conflict])
        break
    }
  }

  const sendComment = () => {
    if (!newComment.trim() || !selectedSection) return

    const comment: Omit<Comment, 'id' | 'timestamp'> = {
      userId: currentUserId,
      userName: 'You',
      section: selectedSection,
      content: newComment.trim(),
      resolved: false
    }

    // Send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'add_comment',
        comment
      }))
    }

    // Add locally
    const fullComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}`,
      timestamp: new Date()
    }
    setComments(prev => [...prev, fullComment])
    onCommentAdd(comment)

    setNewComment('')
  }

  const resolveConflict = (conflictId: string, resolution: 'theirs' | 'yours') => {
    const conflict = conflicts.find(c => c.id === conflictId)
    if (!conflict) return

    const resolvedValue = resolution === 'theirs' ? conflict.theirValue : conflict.yourValue
    onConflictResolve(conflict.section, resolvedValue)
    
    setConflicts(prev => prev.filter(c => c.id !== conflictId))

    // Notify other users
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conflict_resolved',
        conflictId,
        resolution
      }))
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-blue-500'
      case 'nurse': return 'bg-green-500'
      case 'carer': return 'bg-purple-500'
      case 'family': return 'bg-amber-500'
      default: return 'bg-gray-500'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager': return '👔'
      case 'nurse': return '⚕️'
      case 'carer': return '🤝'
      case 'family': return '👨‍👩‍👧‍👦'
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

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Users size={20} className="text-teal" />
          <div className="text-left">
            <h3 className="text-white font-semibold">Real-Time Collaboration</h3>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">
                {activeUsers.filter(u => u.isOnline && u.id !== currentUserId).length} others online
              </span>
              {conflicts.length > 0 && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                  {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative"
          >
            <MessageSquare size={16} />
            {comments.filter(c => !c.resolved).length > 0 && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
            )}
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
          {/* Active Users */}
          <div className="p-4 border-b border-white/10">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Users size={16} />
              Active Users ({activeUsers.filter(u => u.isOnline).length})
            </h4>
            <div className="space-y-2">
              {activeUsers.filter(u => u.isOnline).map(user => (
                <div key={user.id} className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full ${getRoleColor(user.role)} flex items-center justify-center text-white text-sm font-medium`}>
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white/10 ${
                      user.id === currentUserId ? 'bg-teal' : 'bg-green-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">
                        {user.name} {user.id === currentUserId && '(You)'}
                      </span>
                      <span className="text-white/50 text-xs">{getRoleIcon(user.role)}</span>
                    </div>
                    {user.cursor && (
                      <div className="text-white/40 text-xs">
                        Editing: {user.cursor.section}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="p-4 border-b border-white/10 bg-red-500/10">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                Edit Conflicts ({conflicts.length})
              </h4>
              <div className="space-y-3">
                {conflicts.map(conflict => (
                  <div key={conflict.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">
                        {conflict.section} • {conflict.userName}
                      </span>
                      <span className="text-white/50 text-xs">
                        {formatTimeAgo(conflict.timestamp)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <span className="text-red-400">Their change:</span>
                        <div className="text-white/60 mt-1">{JSON.stringify(conflict.theirValue)}</div>
                      </div>
                      <div>
                        <span className="text-teal-400">Your change:</span>
                        <div className="text-white/60 mt-1">{JSON.stringify(conflict.yourValue)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveConflict(conflict.id, 'theirs')}
                        className="flex-1 py-1 px-2 bg-red-500/20 text-red-300 rounded text-xs hover:bg-red-500/30 transition-colors"
                      >
                        Use Theirs
                      </button>
                      <button
                        onClick={() => resolveConflict(conflict.id, 'yours')}
                        className="flex-1 py-1 px-2 bg-teal/20 text-teal rounded text-xs hover:bg-teal/30 transition-colors"
                      >
                        Use Yours
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <MessageSquare size={16} />
                Discussion ({comments.length})
              </h4>
              {comments.filter(c => !c.resolved).length > 0 && (
                <span className="text-amber-400 text-xs">
                  {comments.filter(c => !c.resolved).length} unresolved
                </span>
              )}
            </div>

            {/* New Comment */}
            <div className="mb-4">
              <div className="flex gap-2">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-teal"
                >
                  <option value="">Select section...</option>
                  <option value="objectives">Objectives</option>
                  <option value="risks">Risks</option>
                  <option value="preventive">Preventive</option>
                  <option value="pbsTriggers">PBS Triggers</option>
                  <option value="safetyPlan">Safety Plan</option>
                </select>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm focus:outline-none focus:border-teal"
                />
                <button
                  onClick={sendComment}
                  disabled={!newComment.trim() || !selectedSection}
                  className="px-3 py-2 bg-teal text-navy rounded font-medium text-sm hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {comments.map(comment => (
                <div key={comment.id} className={`p-3 rounded-lg border ${
                  comment.resolved 
                    ? 'bg-white/5 border-white/10 opacity-60' 
                    : 'bg-white/10 border-white/20'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full ${getRoleColor('manager')} flex items-center justify-center text-white text-xs`}>
                        {comment.userName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-white text-sm font-medium">{comment.userName}</span>
                      <span className="text-white/50 text-xs">{comment.section}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs">{formatTimeAgo(comment.timestamp)}</span>
                      {!comment.resolved && (
                        <button className="text-white/40 hover:text-white/60 transition-colors">
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-white/70 text-sm">{comment.content}</p>
                  {comment.resolved && (
                    <div className="mt-2 text-green-400 text-xs flex items-center gap-1">
                      <Check size={12} />
                      Resolved
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

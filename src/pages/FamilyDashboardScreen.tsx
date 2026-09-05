import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { 
  getFamilyDashboard, 
  familyLogout, 
  getCurrentFamilyMember,
  markNotificationRead,
  markAllNotificationsRead,
  hasPermission,
  FAMILY_PERMISSIONS
} from '../api/familyApi'
import { 
  Users, 
  MessageSquare, 
  Calendar, 
  CheckSquare, 
  Bell, 
  Heart, 
  Clock, 
  AlertCircle,
  Settings,
  LogOut,
  Eye,
  EyeOff,
  ChevronRight,
  Home,
  Activity
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

export default function FamilyDashboardScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/family/dashboard')
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'messages' | 'notifications'>('overview')
  
  const familyMember = getCurrentFamilyMember()

  useEffect(() => {
    if (!familyMember) {
      setLocation('/family/login')
      return
    }
    loadDashboard()
  }, [familyMember, setLocation])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const data = await getFamilyDashboard()
      setDashboard(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
      if (err.message?.includes('Unauthorized')) {
        await familyLogout()
        setLocation('/family/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await familyLogout()
    setLocation('/family/login')
  }

  const handleNotificationClick = async (notificationId: string) => {
    await markNotificationRead(notificationId)
    loadDashboard() // Refresh to update notification count
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    loadDashboard()
  }

  const navigateToClient = (clientId: string) => {
    setLocation(`/tenant/default/family/${clientId}`)
  }

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'good': return 'text-green-500'
      case 'fair': return 'text-amber-500'
      case 'concerning': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'good': return '😊'
      case 'fair': return '😐'
      case 'concerning': return '😟'
      default: return '😊'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.darkNavy }}>
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading your family dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.darkNavy }}>
        <div className="text-white text-center max-w-md mx-auto p-6">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Dashboard</h2>
          <p className="text-white/70 mb-4">{error}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-teal text-navy rounded-lg hover:bg-teal/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const unreadCount = dashboard?.notifications?.filter((n: any) => !n.read).length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal rounded-full flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Family Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome back, {familyMember?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-sm text-teal hover:text-teal/80"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {dashboard?.notifications?.length > 0 ? (
                        dashboard.notifications.map((notification: any) => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleNotificationClick(notification.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                !notification.read ? 'bg-blue-500' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                                <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                                <p className="text-gray-400 text-xs mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Settings */}
              <button
                onClick={() => setLocation('/family/settings')}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Settings size={20} />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4">
          <div className="flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: Home },
              { key: 'clients', label: 'My Loved Ones', icon: Heart },
              { key: 'messages', label: 'Messages', icon: MessageSquare },
              { key: 'notifications', label: 'All Notifications', icon: Bell },
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
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Loved Ones</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboard?.clients?.length || 0}</p>
                  </div>
                  <Heart className="text-teal" size={24} />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboard?.clients?.reduce((sum: number, client: any) => sum + (client.pendingTasks || 0), 0) || 0}
                    </p>
                  </div>
                  <CheckSquare className="text-amber-500" size={24} />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unread Messages</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboard?.clients?.reduce((sum: number, client: any) => sum + (client.unreadMessages || 0), 0) || 0}
                    </p>
                  </div>
                  <MessageSquare className="text-blue-500" size={24} />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <div className="p-6">
                {dashboard?.recentActivity?.length > 0 ? (
                  <div className="space-y-4">
                    {dashboard.recentActivity.map((activity: any) => (
                      <div key={activity.id} className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          activity.type === 'visit_completed' ? 'bg-green-100' :
                          activity.type === 'message_received' ? 'bg-blue-100' :
                          'bg-amber-100'
                        }`}>
                          {activity.type === 'visit_completed' ? <CheckSquare size={16} className="text-green-600" /> :
                           activity.type === 'message_received' ? <MessageSquare size={16} className="text-blue-600" /> :
                           <Activity size={16} className="text-amber-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500">
                            {activity.clientName} • {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className="text-gray-400" size={16} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">My Loved Ones</h2>
            {dashboard?.clients?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboard.clients.map((client: any) => (
                  <div key={client.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
                          <p className="text-sm text-gray-500">
                            {client.age ? `${client.age} years` : ''} • {client.condition || 'No condition specified'}
                          </p>
                        </div>
                        <div className="text-2xl">
                          {getMoodIcon(client.moodStatus)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Last Visit</p>
                          <p className="text-sm font-medium text-gray-900">
                            {client.lastVisit ? new Date(client.lastVisit).toLocaleDateString() : 'No visits yet'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Next Visit</p>
                          <p className="text-sm font-medium text-gray-900">
                            {client.nextVisit ? new Date(client.nextVisit).toLocaleDateString() : 'Not scheduled'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1">
                            <MessageSquare size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-600">{client.unreadMessages || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckSquare size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-600">{client.pendingTasks || 0}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigateToClient(client.id)}
                          className="text-teal hover:text-teal/80 text-sm font-medium"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Heart size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No loved ones assigned to your account</p>
                <p className="text-sm text-gray-400 mt-2">Contact your care coordinator for assistance</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-500 text-center py-8">
                  Select a loved one to view messages
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">All Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-sm text-teal hover:text-teal/80"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {dashboard?.notifications?.length > 0 ? (
                  <div className="space-y-4">
                    {dashboard.notifications.map((notification: any) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg ${
                          !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            !notification.read ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{notification.title}</p>
                            <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                            <p className="text-gray-400 text-xs mt-1">
                              {new Date(notification.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No notifications</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

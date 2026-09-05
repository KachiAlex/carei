// Family Push Notification System
// Supports Web Push API (PWA) and Capacitor (Native)

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

class FamilyNotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null
  private isNative = typeof (window as any).Capacitor !== 'undefined'
  private pushSupported = 'PushManager' in window
  
  async init(): Promise<boolean> {
    if (this.isNative) {
      // Native app - use Capacitor Push Notifications plugin
      return this.initNativePush()
    }
    
    // PWA - use Web Push API
    return this.initWebPush()
  }
  
  private async initWebPush(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported')
      return false
    }
    
    try {
      this.swRegistration = await navigator.serviceWorker.ready
      
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.log('Notification permission denied')
        return false
      }
      
      console.log('Web Push initialized for family notifications')
      return true
    } catch (error) {
      console.error('Failed to initialize web push:', error)
      return false
    }
  }
  
  private async initNativePush(): Promise<boolean> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.requestPermissions()
      await PushNotifications.register()
      console.log('Native push notifications initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize native push:', error)
      return false
    }
  }
  
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (this.isNative) {
      await this.showNativeNotification(payload)
    } else {
      await this.showWebNotification(payload)
    }
  }
  
  private async showWebNotification(payload: NotificationPayload): Promise<void> {
    if (!this.swRegistration) return
    
    try {
      await this.swRegistration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        tag: payload.tag || 'family-notification',
        data: payload.data,
        requireInteraction: payload.requireInteraction || false,
      })
    } catch (error) {
      console.error('Failed to show web notification:', error)
    }
  }
  
  private async showNativeNotification(payload: NotificationPayload): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [{
          title: payload.title,
          body: payload.body,
          id: Math.floor(Math.random() * 100000),
          schedule: { at: new Date() },
          extra: payload.data,
        }]
      })
    } catch (error) {
      console.error('Failed to show native notification:', error)
    }
  }
  
  // Specific family notification types
  async notifyVisitCompleted(clientName: string, visitDate: string): Promise<void> {
    await this.showLocalNotification({
      title: 'Visit Completed',
      body: `${clientName}'s care visit on ${visitDate} has been completed.`,
      tag: 'visit-completed',
      data: { type: 'visit', action: 'view_summary' }
    })
  }
  
  async notifyNewMessage(senderName: string, clientName: string): Promise<void> {
    await this.showLocalNotification({
      title: 'New Message',
      body: `${senderName} sent a message about ${clientName}.`,
      tag: 'new-message',
      data: { type: 'message', action: 'open_chat' }
    })
  }
  
  async notifyTaskDue(taskText: string, clientName: string): Promise<void> {
    await this.showLocalNotification({
      title: 'Care Task Reminder',
      body: `Task for ${clientName}: ${taskText}`,
      tag: 'task-reminder',
      data: { type: 'task', action: 'view_tasks' }
    })
  }
  
  async notifyEmergency(clientName: string, alertText: string): Promise<void> {
    await this.showLocalNotification({
      title: '🚨 Emergency Alert',
      body: `${clientName}: ${alertText}`,
      tag: 'emergency',
      requireInteraction: true,
      data: { type: 'emergency', action: 'call_emergency' },
      actions: [
        { action: 'call', title: 'Call Now' },
        { action: 'view', title: 'View Details' }
      ]
    })
  }
}

// Export singleton instance
export const familyNotifications = new FamilyNotificationManager()

// Hook for React components
import { useState, useEffect } from 'react'

export function useFamilyNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  
  useEffect(() => {
    const checkSupport = async () => {
      if ('Notification' in window) {
        setIsSupported(true)
        setPermission(Notification.permission)
      }
    }
    checkSupport()
  }, [])
  
  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    
    const result = await Notification.requestPermission()
    setPermission(result)
    
    if (result === 'granted') {
      await familyNotifications.init()
      return true
    }
    return false
  }
  
  return {
    isSupported,
    permission,
    requestPermission,
    notify: familyNotifications.showLocalNotification.bind(familyNotifications)
  }
}

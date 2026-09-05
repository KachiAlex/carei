export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export async function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') {
    const perm = await requestNotificationPermission()
    if (perm !== 'granted') return
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    })
  } else {
    new Notification(title, {
      icon: '/icon-192.png',
      ...options,
    })
  }
}

export function sendMedicationReminder(clientName: string, medicationName: string) {
  sendLocalNotification('Medication Reminder', {
    body: `${clientName} — ${medicationName} is due now.`,
    tag: `med-${medicationName}`,
    data: { url: '/dashboard', type: 'medication' },
    requireInteraction: true,
  })
}

export function sendVisitStartReminder(clientName: string, visitTime: string) {
  sendLocalNotification('Visit Starting Soon', {
    body: `Your visit with ${clientName} is scheduled for ${visitTime}.`,
    tag: `visit-${clientName}`,
    data: { url: '/dashboard', type: 'visit' },
    requireInteraction: false,
  })
}

export function sendSOSAlert(location: string) {
  sendLocalNotification('SOS Alert', {
    body: `Emergency alert triggered at ${location}.`,
    tag: 'sos-alert',
    data: { url: '/manager', type: 'sos' },
    requireInteraction: true,
  })
}

export function sendSOSResolved(location: string) {
  sendLocalNotification('SOS Resolved', {
    body: `The emergency at ${location} has been resolved.`,
    tag: 'sos-resolved',
    data: { url: '/manager', type: 'sos-resolved' },
    requireInteraction: false,
  })
}

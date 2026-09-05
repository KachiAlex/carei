const CACHE_NAME = 'carei-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return

  const isNavigate = request.mode === 'navigate'
  const isIndex = request.url.endsWith('/index.html') || new URL(request.url).pathname === '/'

  // Navigation and index.html: network first, then cache fallback
  if (isNavigate || isIndex) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          return caches.match('/index.html')
        }).then((fallback) => fallback || new Response('Offline', { status: 503 }))
      })
    )
    return
  }

  // Assets (JS/CSS/images): cache first, then network, then cache update
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        return caches.match('/index.html').then((fallback) => fallback || new Response('Offline', { status: 503 }))
      })
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  event.waitUntil(
    self.registration.showNotification(payload.title || 'carei', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'default',
      data: payload.data || {},
      actions: payload.actions || [],
      requireInteraction: payload.requireInteraction || false,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = data.url || '/'
      const existing = clientList.find((c) => c.url.includes(url))
      if (existing) {
        existing.focus()
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

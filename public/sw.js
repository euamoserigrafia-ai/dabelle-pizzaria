// public/sw.js — Service Worker para PWA Dabelle Pizzaria
const CACHE = 'dabelle-v1'
const PRECACHE = [
  '/',
  '/index.html',
  '/src/styles/main.css',
  '/src/main.js',
  '/manifest.json',
]

// Instala e faz cache dos arquivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// Remove caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first para API Supabase, cache-first para assets estáticos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Supabase e WhatsApp: sempre network, sem cache
  if (url.hostname.includes('supabase') || url.hostname.includes('wa.me')) {
    return
  }

  // Assets estáticos: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/index.html')) // offline fallback
    })
  )
})

// Push notifications (futuro)
self.addEventListener('push', e => {
  if (!e.data) return
  const { title, body, icon } = e.data.json()
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
    })
  )
})

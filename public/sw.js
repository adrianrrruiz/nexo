// Nexo service worker — habilita instalación como PWA y un cascarón offline
// básico. Estrategia: network-first para navegación (para no servir HTML viejo),
// cache-first para assets estáticos ya vistos.
const CACHE = 'nexo-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegación (páginas): network-first con fallback a caché.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match(request)
          return cached ?? caches.match('/')
        }
      })()
    )
    return
  }

  // Assets del mismo origen: cache-first, y refresca en segundo plano.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const fresh = await fetch(request)
      const cache = await caches.open(CACHE)
      cache.put(request, fresh.clone())
      return fresh
    })()
  )
})

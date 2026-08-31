// Nexo service worker — habilita la instalación como PWA.
// Los documentos autenticados nunca se guardan: un saldo financiero obsoleto
// es peor que una pantalla sin conexión. Solo se cachean assets versionados.
const CACHE = 'nexo-static-v2'

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

  // Nunca cachear HTML, Server Components ni APIs con datos del usuario.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request))
    return
  }

  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return

  const isVersionedAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)

  if (!isVersionedAsset) return

  // Los assets estáticos sí son seguros de cachear.
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

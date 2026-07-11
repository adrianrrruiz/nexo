'use client'

import { useEffect } from 'react'

/** Registra el service worker en el cliente para habilitar la PWA. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // silencioso: la app funciona igual sin SW
    })
  }, [])

  return null
}

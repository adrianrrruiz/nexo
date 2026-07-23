'use client'

import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'

type Phase = 'visible' | 'hiding' | 'done'

/** Tiempo mínimo visible para que el splash no "parpadee" en cargas rápidas. */
const MIN_VISIBLE_MS = 450
/** Tope de seguridad por si el evento `load` nunca llega. */
const MAX_VISIBLE_MS = 5000

/**
 * Pantalla de arranque estilo iOS: overlay a pantalla completa con el logo de
 * Nexo centrado. Se muestra en el primer paint (arranque en frío de la PWA) y
 * se desvanece cuando la página termina de cargar. Vive en el layout raíz, así
 * que se renderiza una sola vez y no reaparece al navegar entre pestañas.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('visible')

  useEffect(() => {
    const start = Date.now()

    const startHiding = () => {
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - start))
      window.setTimeout(() => setPhase('hiding'), wait)
    }

    if (document.readyState === 'complete') {
      startHiding()
    } else {
      window.addEventListener('load', startHiding, { once: true })
    }
    const cap = window.setTimeout(() => setPhase('hiding'), MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener('load', startHiding)
      window.clearTimeout(cap)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'hiding') return
    const timer = window.setTimeout(() => setPhase('done'), 450)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (phase === 'done') return null

  return (
    <div
      aria-hidden="true"
      className={`splash-screen${phase === 'hiding' ? ' splash-screen--hiding' : ''}`}
    >
      <Logo className="splash-logo h-20 w-20" id="nexo-splash" />
    </div>
  )
}

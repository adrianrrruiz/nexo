'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { dismissCategoryAnnouncement } from '@/app/(app)/announcement-actions'

export default function CategoryAnnouncement() {
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  if (dismissed) return null

  return (
    <aside aria-labelledby="category-announcement-title" className="mb-7 rounded-3xl border border-brand/25 bg-brand/[0.09] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">Novedad en Nexo</p>
      <h2 id="category-announcement-title" className="mt-2 text-lg font-semibold">Tus categorías, más fáciles de encontrar</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
        Ahora tienes el botón <strong className="text-white">Categorías</strong> en la barra de navegación de abajo (o en el menú lateral si usas computador). También lo encontrarás en <strong className="text-white">Cuentas → Categorías</strong>.
        Elige sugerencias de gastos e ingresos o usa <strong className="text-white">Crear categoría</strong> para añadir las tuyas.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/categorias" className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-neutral-950">Ir a mis categorías →</Link>
        <button type="button" disabled={pending} onClick={() => startTransition(async () => {
          setError(null)
          try {
            const result = await dismissCategoryAnnouncement()
            if (result.ok) setDismissed(true)
            else setError(result.message ?? 'Intenta de nuevo.')
          } catch {
            setError('No pudimos cerrar el anuncio. Intenta de nuevo.')
          }
        })} className="rounded-xl px-4 py-3 text-sm font-medium text-neutral-300 hover:bg-white/5 disabled:opacity-60">{pending ? 'Cerrando…' : 'Entendido'}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </aside>
  )
}

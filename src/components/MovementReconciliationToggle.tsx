'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function MovementReconciliationToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Modo conciliación"
      onClick={() => {
        const params = new URLSearchParams(searchParams)
        if (enabled) params.delete('conciliacion')
        else params.set('conciliacion', '1')
        params.delete('anteriores')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }}
      className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-3 text-xs font-medium text-neutral-200 transition-colors hover:border-brand/30"
    >
      <span>Conciliación</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-white/20'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      <span className="sr-only">{enabled ? 'Activado' : 'Desactivado'}</span>
    </button>
  )
}

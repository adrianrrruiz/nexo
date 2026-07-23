'use client'

import { formatLongDate } from '@/lib/format'

export default function DateTextField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      {/*
        El input real se superpone transparente y a tamaño completo, de modo que
        el toque cae directamente sobre él. iOS Safari solo abre el selector de
        fecha nativo cuando el usuario toca un <input type="date"> visible y
        tappable; ocultarlo y reenviarle un .click()/showPicker() desde otro
        elemento no lo abre en iPhone.
      */}
      <input
        type="date"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Fecha del movimiento"
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"
      />
      <div className="pointer-events-none flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-left text-base text-neutral-100 transition-colors peer-focus:border-brand/60">
        <span className="capitalize">{formatLongDate(value)}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 3v3M17 3v3" />
          <rect x="4" y="5" width="16" height="16" rx="3" />
          <path d="M4 10h16" />
        </svg>
      </div>
    </div>
  )
}

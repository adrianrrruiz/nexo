'use client'

import { useEffect, useId, useRef } from 'react'

export default function InvestmentDialog({ title, onClose, busy, children }: {
  title: string
  onClose: () => void
  busy?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-white/15 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-neutral-100 backdrop:bg-black/75 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl sm:p-6"
    >
      <header className="mb-4 flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-xl font-semibold">{title}</h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          disabled={busy}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-2xl leading-none text-neutral-400 hover:text-white disabled:opacity-45"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}

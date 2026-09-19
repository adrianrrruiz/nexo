'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  updateAccountReconciliation,
  type AccountState,
} from '@/app/(app)/cuentas/actions'

export default function AccountReconciliation({
  accountId,
  accountName,
  reconciledThrough,
  note,
}: {
  accountId: string
  accountName: string
  reconciledThrough: string | null
  note: string | null
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<AccountState, FormData>(
    updateAccountReconciliation,
    null
  )

  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => setOpen(false), 600)
      return () => clearTimeout(timer)
    }
  }, [state])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20"
        aria-label={`Editar conciliación de ${accountName}`}
      >
        {reconciledThrough ? 'Actualizar' : 'Conciliar'}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reconciliation-title-${accountId}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
            }}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 lg:rounded-[28px] lg:border"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={`reconciliation-title-${accountId}`} className="text-lg font-semibold">
                  Conciliación de {accountName}
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Marca hasta qué día comparaste esta cuenta con el banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400"
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form key={`${reconciledThrough ?? ''}:${note ?? ''}`} action={action} className="space-y-4">
              <input type="hidden" name="id" value={accountId} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-300">Conciliada hasta el día</span>
                <input
                  type="date"
                  name="reconciled_through"
                  required
                  autoFocus
                  defaultValue={reconciledThrough ?? ''}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-base outline-none focus:border-brand/60"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-300">Nota (opcional)</span>
                <textarea
                  name="reconciliation_note"
                  rows={4}
                  maxLength={1000}
                  defaultValue={note ?? ''}
                  placeholder="Ej.: coincide con el extracto de agosto; pendiente confirmar intereses."
                  className="w-full resize-y rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-base outline-none focus:border-brand/60"
                />
              </label>
              <p className="text-xs text-neutral-500">
                Esta marca no modifica el saldo ni impide corregir movimientos anteriores.
                Si cambias uno de esos movimientos, vuelve a conciliar la cuenta.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 disabled:opacity-60"
              >
                {pending ? 'Guardando...' : 'Guardar conciliación'}
              </button>
              {reconciledThrough && (
                <button
                  type="submit"
                  name="clear"
                  value="1"
                  formNoValidate
                  disabled={pending}
                  className="w-full rounded-2xl border border-white/10 py-3 text-sm text-neutral-300 disabled:opacity-60"
                >
                  Quitar marca de conciliación
                </button>
              )}
              {state && (
                <p role="status" className={`text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}>
                  {state.message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

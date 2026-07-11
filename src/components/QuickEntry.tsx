'use client'

import { useActionState, useEffect, useState } from 'react'
import { addTransaction, type EntryState } from '@/app/(app)/dashboard/actions'
import { formatCOPFromCents } from '@/lib/format'
import type { Account, Category, TransactionType } from '@/lib/supabase/types'

const TYPES: { value: TransactionType; label: string; active: string }[] = [
  {
    value: 'expense',
    label: 'Gasto',
    active: 'bg-red-500/15 border-red-500/40 text-red-400',
  },
  {
    value: 'income',
    label: 'Ingreso',
    active: 'bg-brand/15 border-brand/40 text-brand',
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    active: 'bg-sky-500/15 border-sky-500/40 text-sky-400',
  },
]

const FIELD =
  'w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-base outline-none focus:border-brand/60'

export default function QuickEntry({
  accounts,
  categories,
}: {
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TransactionType>('expense')
  const [amountCents, setAmountCents] = useState('')
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    addTransaction,
    null
  )

  // cierra el panel al registrar con éxito
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setOpen(false), 800)
      return () => clearTimeout(t)
    }
  }, [state])

  const kind = type === 'income' ? 'income' : 'expense'
  const cats = categories.filter((c) => c.kind === kind)
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  })

  if (!open) {
    return (
      <button
        onClick={() => {
          setAmountCents('')
          setOpen(true)
        }}
        className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-neutral-950 shadow-lg shadow-brand/25 active:scale-95 transition-transform"
        aria-label="Nuevo movimiento"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo movimiento</h2>
          <button
            onClick={() => {
              setAmountCents('')
              setOpen(false)
            }}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* selector de tipo */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-2xl border py-2.5 text-xs font-semibold transition-colors ${
                type === t.value
                  ? t.active
                  : 'border-white/[0.08] text-neutral-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="amount"
            value={amountCents ? (Number(amountCents) / 100).toFixed(2) : ''}
          />

          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="$ 0,00"
            value={amountCents ? formatCOPFromCents(amountCents) : ''}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key)) {
                event.preventDefault()
                const hasSelection =
                  event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
                setAmountCents((current) =>
                  `${hasSelection ? '' : current}${event.key}`.replace(/^0+(?=\d)/, '')
                )
                return
              }
              if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault()
                const hasSelection =
                  event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
                setAmountCents((current) => (hasSelection ? '' : current.slice(0, -1)))
              }
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
              setAmountCents(digits)
            }}
            onPaste={(event) => {
              event.preventDefault()
              const digits = event.clipboardData
                .getData('text')
                .replace(/\D/g, '')
                .replace(/^0+(?=\d)/, '')
              setAmountCents(digits)
            }}
            className={`${FIELD} text-lg font-semibold`}
          />

          <div className="flex gap-2">
            <select name="account_id" required className={FIELD}>
              <option value="">{type === 'transfer' ? 'Desde…' : 'Cuenta'}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {type === 'transfer' && (
              <select name="to_account_id" required className={FIELD}>
                <option value="">Hacia…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {type !== 'transfer' && (
            <select name="category_id" className={FIELD}>
              <option value="">Categoría (opcional)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? '— ' : ''}
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <input type="date" name="date" defaultValue={today} className={FIELD} />

          <input
            type="text"
            name="note"
            placeholder="Nota (opcional)"
            className={FIELD}
          />

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 disabled:opacity-60 active:opacity-90"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>

          {state && (
            <p
              className={`text-center text-sm ${
                state.ok ? 'text-brand' : 'text-red-400'
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

'use client'

import { useActionState, useEffect, useState } from 'react'
import { addTransaction, type EntryState } from '@/app/dashboard/actions'
import type { Account, Category, TransactionType } from '@/lib/supabase/types'

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'expense', label: 'Gasto', color: 'bg-red-500' },
  { value: 'income', label: 'Ingreso', color: 'bg-emerald-500' },
  { value: 'transfer', label: 'Transferencia', color: 'bg-sky-500' },
]

export default function QuickEntry({
  accounts,
  categories,
}: {
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TransactionType>('expense')
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
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-full bg-indigo-600 text-3xl leading-none shadow-lg shadow-indigo-900/40 active:bg-indigo-700"
        aria-label="Nuevo movimiento"
      >
        +
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-3xl bg-neutral-900 border-t border-neutral-800 p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo movimiento</h2>
          <button onClick={() => setOpen(false)} className="text-neutral-400 text-2xl">
            ×
          </button>
        </div>

        {/* selector de tipo */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-xl py-2 text-sm font-medium border ${
                type === t.value
                  ? `${t.color} border-transparent text-white`
                  : 'border-neutral-700 text-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="type" value={type} />

          <input
            type="number"
            name="amount"
            inputMode="decimal"
            step="1"
            min="1"
            required
            placeholder="Monto (COP)"
            className="w-full rounded-xl bg-neutral-800 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex gap-2">
            <select
              name="account_id"
              required
              className="flex-1 rounded-xl bg-neutral-800 px-3 py-3 outline-none"
            >
              <option value="">{type === 'transfer' ? 'Desde…' : 'Cuenta'}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {type === 'transfer' && (
              <select
                name="to_account_id"
                required
                className="flex-1 rounded-xl bg-neutral-800 px-3 py-3 outline-none"
              >
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
            <select
              name="category_id"
              className="w-full rounded-xl bg-neutral-800 px-3 py-3 outline-none"
            >
              <option value="">Categoría (opcional)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? '— ' : ''}
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="date"
            name="date"
            defaultValue={today}
            className="w-full rounded-xl bg-neutral-800 px-3 py-3 outline-none"
          />

          <input
            type="text"
            name="note"
            placeholder="Nota (opcional)"
            className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
          />

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 py-3 font-medium disabled:opacity-60 active:bg-indigo-700"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>

          {state && (
            <p
              className={`text-center text-sm ${
                state.ok ? 'text-emerald-400' : 'text-red-400'
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

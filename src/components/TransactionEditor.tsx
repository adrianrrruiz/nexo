'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  deleteTransaction,
  updateTransaction,
  type EntryState,
} from '@/app/(app)/dashboard/actions'
import DateTextField from '@/components/DateTextField'
import { sortCategoriesForSelect } from '@/lib/categories'
import { formatCOPFromCents, formatDateInputValue } from '@/lib/format'
import type { Account, Category, Transaction, TransactionType } from '@/lib/supabase/types'

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

export default function TransactionEditor({
  transaction,
  accounts,
  categories,
  renderTrigger,
}: {
  transaction: Pick<
    Transaction,
    | 'id'
    | 'type'
    | 'amount'
    | 'occurred_at'
    | 'account_id'
    | 'to_account_id'
    | 'category_id'
    | 'note'
  >
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
  renderTrigger?: (open: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TransactionType>(
    transaction.type === 'adjustment' ? 'expense' : transaction.type
  )
  const [amountCents, setAmountCents] = useState(() =>
    String(Math.round(Number(transaction.amount) * 100))
  )
  const [dateValue, setDateValue] = useState(() =>
    formatDateInputValue(transaction.occurred_at)
  )
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    updateTransaction,
    null
  )
  const [deleteState, deleteAction, deleting] = useActionState<EntryState, FormData>(
    deleteTransaction,
    null
  )

  useEffect(() => {
    if (state?.ok || deleteState?.ok) {
      const t = setTimeout(() => setOpen(false), 700)
      return () => clearTimeout(t)
    }
  }, [state, deleteState])

  const kind = type === 'income' ? 'income' : 'expense'
  const cats = categories.filter((c) => c.kind === kind)
  const parentCats = sortCategoriesForSelect(cats).filter((c) => !c.parent_id)
  const childrenByParent = new Map<string, typeof cats>()
  for (const category of cats) {
    if (!category.parent_id) continue
    const list = childrenByParent.get(category.parent_id)
    if (list) list.push(category)
    else childrenByParent.set(category.parent_id, [category])
  }

  const openEditor = () => {
    setType(transaction.type === 'adjustment' ? 'expense' : transaction.type)
    setAmountCents(String(Math.round(Number(transaction.amount) * 100)))
    setDateValue(formatDateInputValue(transaction.occurred_at))
    setOpen(true)
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openEditor)
      ) : (
        <button
          type="button"
          onClick={openEditor}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-neutral-500 transition-colors hover:text-brand"
          aria-label="Editar movimiento"
        >
          Editar
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar movimiento</h2>
              <button
                onClick={() => setOpen(false)}
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
              <input type="hidden" name="id" value={transaction.id} />
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
                  const digits = event.target.value
                    .replace(/\D/g, '')
                    .replace(/^0+(?=\d)/, '')
                  setAmountCents(digits)
                }}
                className={`${FIELD} text-lg font-semibold`}
              />

              <div className="flex gap-2">
                <select name="account_id" required defaultValue={transaction.account_id} className={FIELD}>
                  <option value="">{type === 'transfer' ? 'Desde...' : 'Cuenta'}</option>
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
                    defaultValue={transaction.to_account_id ?? ''}
                    className={FIELD}
                  >
                    <option value="">Hacia...</option>
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
                  defaultValue={transaction.category_id ?? ''}
                  className={FIELD}
                >
                  <option value="">Categoría (opcional)</option>
                  {parentCats.map((parent) => {
                    const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
                      a.name.localeCompare(b.name, 'es')
                    )
                    return (
                      <optgroup key={parent.id} label={parent.name}>
                        <option value={parent.id}>{parent.name}</option>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              )}

              <DateTextField name="date" value={dateValue} onChange={setDateValue} />

              <input
                type="text"
                name="note"
                defaultValue={transaction.note ?? ''}
                placeholder="Nota (opcional)"
                className={FIELD}
              />

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 disabled:opacity-60 active:opacity-90"
              >
                {pending ? 'Guardando...' : 'Guardar cambios'}
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

            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!confirm('¿Eliminar este movimiento?')) event.preventDefault()
              }}
              className="mt-3"
            >
              <input type="hidden" name="id" value={transaction.id} />
              <button
                type="submit"
                disabled={deleting}
                className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 transition-colors active:bg-red-500/20 disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Eliminar movimiento'}
              </button>
              {deleteState && !deleteState.ok && (
                <p className="mt-2 text-center text-sm text-red-400">
                  {deleteState.message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

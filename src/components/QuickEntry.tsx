'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTransaction, type EntryState } from '@/app/(app)/dashboard/actions'
import AmountField from '@/components/AmountField'
import DateTextField from '@/components/DateTextField'
import { sortCategoriesForSelect } from '@/lib/categories'
import { formatDateInputValue } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
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
  defaultDate,
  trigger,
}: {
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
  defaultDate?: string
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const today = formatDateInputValue(new Date())
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TransactionType>('expense')
  const [amountCents, setAmountCents] = useState('')
  const [dateValue, setDateValue] = useState(defaultDate ?? today)
  const [availableCategories, setAvailableCategories] = useState(categories)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    addTransaction,
    null
  )

  // cierra el panel al registrar con éxito
  useEffect(() => {
    if (state?.ok) {
      router.refresh()
      const t = setTimeout(() => setOpen(false), 800)
      return () => clearTimeout(t)
    }
  }, [router, state])

  const kind = type === 'income' ? 'income' : 'expense'
  const cats = availableCategories.filter((c) => c.kind === kind)
  const parentCats = sortCategoriesForSelect(cats).filter((c) => !c.parent_id)
  const childrenByParent = new Map<string, typeof cats>()
  for (const category of cats) {
    if (!category.parent_id) continue
    const list = childrenByParent.get(category.parent_id)
    if (list) list.push(category)
    else childrenByParent.set(category.parent_id, [category])
  }
  const refreshCategories = async () => {
    setLoadingCategories(true)
    setCategoryError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,kind,parent_id')
      .eq('is_suggested', false)
      .order('kind')
      .order('name')

    if (error) {
      setCategoryError('No pudimos actualizar las categorías. Intenta de nuevo.')
    } else {
      setAvailableCategories(
        (data ?? []) as Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
      )
    }
    setLoadingCategories(false)
  }

  const openPanel = () => {
    setAmountCents('')
    setDateValue(defaultDate ?? today)
    setOpen(true)
    void refreshCategories()
  }

  if (!open) {
    if (trigger) {
      return (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Nuevo movimiento"
          className="inline-flex appearance-none bg-transparent p-0"
        >
          {trigger}
        </button>
      )
    }

    return (
      <button
        onClick={openPanel}
        className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-neutral-950 shadow-lg shadow-brand/25 transition-transform active:scale-95 lg:bottom-8 lg:right-8 lg:h-auto lg:w-auto lg:gap-2 lg:rounded-2xl lg:px-5 lg:py-3.5"
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
        <span className="hidden text-sm font-semibold lg:inline">Nuevo movimiento</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-8">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 lg:rounded-[28px] lg:border">
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
          <AmountField name="amount" value={amountCents} onChange={setAmountCents} />

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
            <div>
              <select
                name="category_id"
                className={FIELD}
                disabled={loadingCategories && availableCategories.length === 0}
              >
                <option value="">
                  {loadingCategories && availableCategories.length === 0
                    ? 'Cargando categorías…'
                    : 'Categoría (opcional)'}
                </option>
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
              {categoryError && (
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-amber-300">
                  <span>{categoryError}</span>
                  <button
                    type="button"
                    onClick={() => void refreshCategories()}
                    className="shrink-0 font-semibold text-brand"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}

          <DateTextField name="date" value={dateValue} onChange={setDateValue} />

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

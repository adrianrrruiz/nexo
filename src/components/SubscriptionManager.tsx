'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSubscription,
  deleteSubscription,
  toggleSubscription,
  updateSubscription,
  type SubscriptionState,
} from '@/app/(app)/suscripciones/actions'
import AmountField from '@/components/AmountField'
import DateTextField from '@/components/DateTextField'
import { sortCategoriesForSelect } from '@/lib/categories'
import { formatDateInputValue } from '@/lib/format'
import { FREQUENCIES, FREQUENCY_LABEL, findSubscriptionCategoryId } from '@/lib/subscriptions'
import type {
  Account,
  Category,
  Subscription,
  SubscriptionFrequency,
} from '@/lib/supabase/types'

const FIELD =
  'w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-base outline-none focus:border-brand/60'

export type SubscriptionAccount = Pick<Account, 'id' | 'name'>
export type SubscriptionCategory = Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>

export function NewSubscriptionButton({
  accounts,
  categories,
}: {
  accounts: SubscriptionAccount[]
  categories: SubscriptionCategory[]
}) {
  return <SubscriptionForm mode="create" accounts={accounts} categories={categories} />
}

export function EditSubscriptionButton({
  subscription,
  accounts,
  categories,
}: {
  subscription: Subscription
  accounts: SubscriptionAccount[]
  categories: SubscriptionCategory[]
}) {
  return (
    <SubscriptionForm
      mode="edit"
      subscription={subscription}
      accounts={accounts}
      categories={categories}
    />
  )
}

function SubscriptionForm({
  mode,
  subscription,
  accounts,
  categories,
}: {
  mode: 'create' | 'edit'
  subscription?: Subscription
  accounts: SubscriptionAccount[]
  categories: SubscriptionCategory[]
}) {
  const router = useRouter()
  const today = formatDateInputValue(new Date())
  // por defecto la categoría "Suscripciones" del usuario, si ya la creó
  const defaultCategoryId = findSubscriptionCategoryId(categories) ?? ''

  const [open, setOpen] = useState(false)
  const [amountCents, setAmountCents] = useState(
    subscription ? String(Math.round(Number(subscription.amount) * 100)) : ''
  )
  const [dateValue, setDateValue] = useState(subscription?.next_charge_on ?? today)
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(
    subscription?.frequency ?? 'monthly'
  )
  const [categoryId, setCategoryId] = useState(
    subscription ? subscription.category_id ?? '' : defaultCategoryId
  )

  const [state, action, pending] = useActionState<SubscriptionState, FormData>(
    mode === 'create' ? createSubscription : updateSubscription,
    null
  )
  const [deleteState, deleteAction, deleting] = useActionState<SubscriptionState, FormData>(
    deleteSubscription,
    null
  )
  const [toggleState, toggleAction, toggling] = useActionState<SubscriptionState, FormData>(
    toggleSubscription,
    null
  )

  useEffect(() => {
    if (state?.ok || deleteState?.ok || toggleState?.ok) {
      router.refresh()
      const timer = setTimeout(() => setOpen(false), 700)
      return () => clearTimeout(timer)
    }
  }, [router, state, deleteState, toggleState])

  const expenseCategories = sortCategoriesForSelect(
    categories.filter((category) => category.kind === 'expense')
  )
  const parentCategories = expenseCategories.filter((category) => !category.parent_id)
  const childrenByParent = new Map<string, SubscriptionCategory[]>()
  for (const category of expenseCategories) {
    if (!category.parent_id) continue
    const list = childrenByParent.get(category.parent_id)
    if (list) list.push(category)
    else childrenByParent.set(category.parent_id, [category])
  }

  const openPanel = () => {
    setAmountCents(
      subscription ? String(Math.round(Number(subscription.amount) * 100)) : ''
    )
    setDateValue(subscription?.next_charge_on ?? today)
    setFrequency(subscription?.frequency ?? 'monthly')
    setCategoryId(subscription ? subscription.category_id ?? '' : defaultCategoryId)
    setOpen(true)
  }

  if (!open) {
    return mode === 'create' ? (
      <button
        type="button"
        onClick={openPanel}
        className="flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand to-brand-deep px-4 text-sm font-semibold text-neutral-950 transition-transform active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nueva
      </button>
    ) : (
      <button
        type="button"
        onClick={openPanel}
        aria-label={`Editar ${subscription?.name ?? 'suscripción'}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-400 transition-colors hover:border-brand/40 hover:text-brand"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-8">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 lg:rounded-[28px] lg:border">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Nueva suscripción' : 'Editar suscripción'}
          </h2>
          <button
            type="button"
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

        <form action={action} className="space-y-3">
          {subscription && <input type="hidden" name="id" value={subscription.id} />}

          <input
            type="text"
            name="name"
            required
            maxLength={80}
            defaultValue={subscription?.name ?? ''}
            placeholder="Nombre (Netflix, Spotify…)"
            aria-label="Nombre de la suscripción"
            className={FIELD}
          />

          <AmountField
            name="amount"
            value={amountCents}
            onChange={setAmountCents}
            label="Monto del cobro"
          />

          <select
            name="account_id"
            required
            defaultValue={subscription?.account_id ?? ''}
            aria-label="Cuenta de cobro"
            className={FIELD}
          >
            <option value="">Cuenta de cobro</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <select
            name="category_id"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Categoría"
            className={FIELD}
          >
            <option value="">Categoría (opcional)</option>
            {parentCategories.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {(childrenByParent.get(parent.id) ?? []).map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            name="frequency"
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as SubscriptionFrequency)
            }
            aria-label="Frecuencia"
            className={FIELD}
          >
            {FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {FREQUENCY_LABEL[value]}
              </option>
            ))}
          </select>

          <div>
            <DateTextField
              name="next_charge_on"
              value={dateValue}
              onChange={setDateValue}
              label="Próximo cobro"
            />
            <p className="mt-1.5 px-1 text-xs text-neutral-500">
              Próximo cobro. Ese día te la recordamos para registrarla.
            </p>
          </div>

          <input
            type="text"
            name="note"
            defaultValue={subscription?.note ?? ''}
            placeholder="Nota (opcional)"
            aria-label="Nota"
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
              className={`text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}
            >
              {state.message}
            </p>
          )}
        </form>

        {mode === 'edit' && subscription && (
          <div className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
            <form action={toggleAction} className="flex-1">
              <input type="hidden" name="id" value={subscription.id} />
              <button
                type="submit"
                disabled={toggling}
                className="w-full rounded-2xl border border-white/[0.08] py-3 text-sm font-semibold text-neutral-300 disabled:opacity-60"
              >
                {subscription.active ? 'Pausar' : 'Reactivar'}
              </button>
            </form>
            <form action={deleteAction} className="flex-1">
              <input type="hidden" name="id" value={subscription.id} />
              <button
                type="submit"
                disabled={deleting}
                className="w-full rounded-2xl border border-red-500/30 py-3 text-sm font-semibold text-red-400 disabled:opacity-60"
              >
                Eliminar
              </button>
            </form>
          </div>
        )}

        {(deleteState || toggleState) && (
          <p
            className={`mt-3 text-center text-sm ${
              (deleteState ?? toggleState)?.ok ? 'text-brand' : 'text-red-400'
            }`}
          >
            {(deleteState ?? toggleState)?.message}
          </p>
        )}
      </div>
    </div>
  )
}

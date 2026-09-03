'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  confirmSubscriptionCharge,
  skipSubscriptionCharge,
  type SubscriptionState,
} from '@/app/(app)/suscripciones/actions'
import { formatCOP } from '@/lib/format'

export type DueSubscription = {
  id: string
  name: string
  amount: number
  accountName: string
  categoryLabel: string | null
  dueLabel: string
  overdue: boolean
}

/**
 * Cobros que ya llegaron a su fecha. Un toque en "Registrar" crea el gasto y
 * adelanta la suscripción al siguiente periodo.
 */
export default function SubscriptionDueList({ items }: { items: DueSubscription[] }) {
  if (items.length === 0) return null

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <DueRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

function DueRow({ item }: { item: DueSubscription }) {
  const router = useRouter()
  const [confirmState, confirmAction, confirming] = useActionState<
    SubscriptionState,
    FormData
  >(confirmSubscriptionCharge, null)
  const [skipState, skipAction, skipping] = useActionState<SubscriptionState, FormData>(
    skipSubscriptionCharge,
    null
  )

  useEffect(() => {
    if (confirmState?.ok || skipState?.ok) router.refresh()
  }, [router, confirmState, skipState])

  const busy = confirming || skipping
  const errorMessage =
    (confirmState && !confirmState.ok && confirmState.message) ||
    (skipState && !skipState.ok && skipState.message) ||
    null

  return (
    <li className="rounded-3xl border border-brand/20 bg-brand/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-100">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-400">
            {item.accountName}
            {item.categoryLabel ? ` · ${item.categoryLabel}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-neutral-100">
            {formatCOP(item.amount)}
          </p>
          <p
            className={`mt-0.5 text-[11px] font-medium ${
              item.overdue ? 'text-amber-300' : 'text-brand'
            }`}
          >
            {item.dueLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <form action={confirmAction} className="flex-1">
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-60 active:opacity-90"
          >
            {confirming ? 'Registrando…' : 'Registrar'}
          </button>
        </form>
        <form action={skipAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200 disabled:opacity-60"
          >
            {skipping ? 'Omitiendo…' : 'Omitir'}
          </button>
        </form>
      </div>

      {errorMessage && (
        <p className="mt-2 text-center text-xs text-red-400">{errorMessage}</p>
      )}
    </li>
  )
}

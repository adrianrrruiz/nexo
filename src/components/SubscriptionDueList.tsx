'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmSubscriptionCharge, skipSubscriptionCharge, type SubscriptionState } from '@/app/(app)/suscripciones/actions'
import AmountField from '@/components/AmountField'
import DateTextField from '@/components/DateTextField'
import { formatCOP } from '@/lib/format'
import { todayInBogota } from '@/lib/subscriptions'

export type DueSubscription = {
  id: string
  name: string
  amount: number
  accountName: string
  accountId: string | null
  kind: 'subscription' | 'service'
  nextChargeOn: string
  categoryLabel: string | null
  dueLabel: string
  overdue: boolean
  editControl?: React.ReactNode
}
type AccountOption = { id: string; name: string }

export default function SubscriptionDueList({ items, accounts }: { items: DueSubscription[]; accounts: AccountOption[] }) {
  if (items.length === 0) return null
  return <ul className="space-y-2">{items.map(item => <DueRow key={`${item.id}-${item.nextChargeOn}`} item={item} accounts={accounts} />)}</ul>
}

function DueRow({ item, accounts }: { item: DueSubscription; accounts: AccountOption[] }) {
  const router = useRouter()
  const [confirmState, confirmAction, confirming] = useActionState<SubscriptionState, FormData>(confirmSubscriptionCharge, null)
  const [skipState, skipAction, skipping] = useActionState<SubscriptionState, FormData>(skipSubscriptionCharge, null)
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(Math.round(item.amount * 100)))
  const [accountId, setAccountId] = useState(accounts.some(account => account.id === item.accountId) ? item.accountId! : '')
  const [date, setDate] = useState(todayInBogota())
  useEffect(() => { if (confirmState?.ok || skipState?.ok) router.refresh() }, [router, confirmState, skipState])
  const busy = confirming || skipping
  const error = (confirmState && !confirmState.ok && confirmState.message) || (skipState && !skipState.ok && skipState.message)
  const needsDetails = item.kind === 'service' || !accountId
  if (confirmState?.ok || skipState?.ok) return <li role="status" className="rounded-2xl border border-brand/20 p-4 text-sm text-brand">{(confirmState?.ok ? confirmState : skipState)?.message}</li>
  return <li className="min-w-0 rounded-3xl border border-brand/20 bg-brand/[0.06] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-36">
        <div className="flex items-start gap-2"><p className="min-w-0 flex-1 break-words text-sm font-semibold text-neutral-100">{item.name}</p>{item.editControl}</div>
        <p className="mt-1 break-words text-xs text-neutral-400">{item.accountName}{item.categoryLabel ? ` · ${item.categoryLabel}` : ''}</p>
      </div>
      <div className="max-w-full text-right">
        <p className="break-words text-sm font-semibold tabular-nums text-neutral-100">{item.kind === 'service' ? '≈ ' : ''}{formatCOP(item.amount)}</p>
        <p className={`mt-1 text-xs ${item.overdue ? 'text-amber-300' : 'text-brand'}`}>{item.dueLabel}</p>
      </div>
    </div>
    {editing && <form action={confirmAction} className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] p-3">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="expected_charge_on" value={item.nextChargeOn} />
      <fieldset disabled={busy} className="space-y-3">
        <div><p className="mb-2 text-xs text-neutral-300">Monto real pagado</p><AmountField name="amount" value={amount} onChange={setAmount} label={`Monto real de ${item.name}`} /></div>
        <div><p className="mb-2 text-xs text-neutral-300">Cuenta desde la que pagaste</p>
          <select name="account_id" required aria-label={`Cuenta para pagar ${item.name}`} value={accountId} onChange={event => setAccountId(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-surface px-3 py-3 text-base">
            <option value="">Elige una cuenta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          {accounts.length === 0 && <Link href="/cuentas" className="mt-2 inline-block text-xs text-brand">Crea una cuenta para registrar el gasto →</Link>}
        </div>
        <DateTextField name="charged_on" required value={date} onChange={setDate} label="Fecha real del pago" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !accountId || Number(amount) <= 0} className="min-h-11 flex-1 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40">{confirming ? 'Registrando…' : 'Confirmar gasto'}</button>
          <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-xl px-3 text-sm text-neutral-400">Cancelar</button>
        </div>
      </fieldset>
    </form>}
    {!editing && <div className="mt-3 flex flex-wrap gap-2">
      {needsDetails ? <button type="button" disabled={busy} onClick={() => setEditing(true)} className="min-h-11 flex-1 rounded-2xl bg-brand px-3 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40">Registrar gasto</button> : <form action={confirmAction} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="expected_charge_on" value={item.nextChargeOn} />
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-2xl bg-brand px-3 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40">{confirming ? 'Registrando…' : 'Registrar gasto'}</button>
      </form>}
      <form action={skipAction} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="expected_charge_on" value={item.nextChargeOn} />
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-2xl border border-white/[0.08] px-3 py-2.5 text-sm text-neutral-400 disabled:opacity-40">{skipping ? 'Cerrando…' : 'Cerrar recordatorio'}</button>
      </form>
    </div>}
    {!editing && <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">Cerrar pasa al siguiente período sin registrar un gasto.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
  </li>
}

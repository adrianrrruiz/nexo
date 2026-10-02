'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { createSubscription, type SubscriptionState } from '@/app/(app)/suscripciones/actions'
import AmountField from '@/components/AmountField'
import DateTextField from '@/components/DateTextField'
import { sortCategoriesForSelect } from '@/lib/categories'
import { formatCOP, formatLongDate } from '@/lib/format'
import { findSubscriptionCategoryId, FREQUENCIES, FREQUENCY_LABEL, monthlyEquivalent, todayInBogota } from '@/lib/subscriptions'
import type { Account, Category, SubscriptionFrequency } from '@/lib/supabase/types'

type Props = {
  kind?: 'subscription' | 'service'
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
}
const FIELD = 'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-base outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/10'
const PRIMARY = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-deep px-4 py-3.5 text-sm font-semibold text-neutral-950 disabled:opacity-40'

export default function CreateSubscriptionButton(props: Props) {
  const isService = props.kind === 'service'
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-950">+ Crear {isService ? 'servicio' : 'suscripción'}</button>
    {open && <SubscriptionDialog key={attempt} {...props} onClose={() => setOpen(false)} onCreateAnother={() => setAttempt(current => current + 1)} />}
  </>
}

function SubscriptionDialog({ accounts, categories, kind = 'subscription', onClose, onCreateAnother }: Props & { onClose: () => void; onCreateAnother: () => void }) {
  const isService = kind === 'service'
  const noun = isService ? 'servicio' : 'suscripción'
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('monthly')
  const [accountId, setAccountId] = useState(!isService && accounts.length === 1 ? accounts[0].id : '')
  const [categoryId, setCategoryId] = useState(isService ? '' : findSubscriptionCategoryId(categories) ?? '')
  const [date, setDate] = useState(todayInBogota())
  const [until, setUntil] = useState(todayInBogota())
  const [note, setNote] = useState('')
  const [state, action, pending] = useActionState<SubscriptionState, FormData>(createSubscription, null)
  const amountValue = Number(amount || '0') / 100
  const expenseCategories = sortCategoriesForSelect(categories.filter(category => category.kind === 'expense'))
  const categoryNames = new Map(expenseCategories.map(category => [category.id, category.name]))
  const accountName = accounts.find(account => account.id === accountId)?.name
  const canContinue = Boolean(name.trim() && Number.isFinite(amountValue) && amountValue > 0)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    headingRef.current?.focus()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])
  useEffect(() => { headingRef.current?.focus() }, [step, state?.ok])

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { if (pending) event.preventDefault(); else onClose() }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-neutral-100 backdrop:bg-black/75 backdrop:backdrop-blur-sm">
    <div className="flex h-full items-end justify-center sm:items-center sm:p-5">
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-surface shadow-2xl sm:rounded-[28px]">
        <header className="shrink-0 px-5 pb-4 pt-5 sm:px-7">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Cada cobro, bajo control</p>
              <h2 ref={headingRef} tabIndex={-1} id={`${id}-title`} className="text-2xl font-semibold tracking-tight outline-none">{state?.ok ? `Tu ${noun} está ${isService ? 'listo' : 'lista'}` : step === 1 ? isService ? 'Organiza tus servicios' : '¿Qué pagas regularmente?' : 'Organiza el próximo cobro'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{state?.ok ? 'Verás el recordatorio cuando comience el próximo cobro.' : 'Nexo te recuerda el cobro. Tú decides cuándo registrar el gasto.'}</p>
            </div>
            <button type="button" onClick={onClose} disabled={pending} aria-label={`Cerrar creación de ${noun}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-neutral-400 disabled:opacity-40">✕</button>
          </div>
          {!state?.ok && (isService || accounts.length > 0) && <ol aria-label="Pasos de creación" className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {['Nombre y monto', isService ? 'Rango y cuenta' : 'Fecha y cuenta'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`rounded-xl border px-3 py-2.5 ${step === index + 1 ? 'border-brand/20 bg-brand/[0.08] text-brand' : 'border-white/[0.05] text-neutral-500'}`}>{index + 1}. {label}</li>)}
          </ol>}
        </header>
        {!isService && accounts.length === 0 ? <div className="overflow-y-auto px-5 pb-6 sm:px-7">
          <p className="mb-4 text-sm leading-relaxed text-neutral-300">Primero crea una cuenta para elegir de dónde pagarás tus suscripciones.</p>
          <Link href="/cuentas" onClick={onClose} className={PRIMARY}>Crear mi primera cuenta →</Link>
        </div> : state?.ok ? <div className="overflow-y-auto px-5 pb-6 sm:px-7">
          <div className="mb-5 rounded-3xl border border-brand/20 bg-brand/[0.06] p-5">
            <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand">✓</span>
            <p className="break-words text-lg font-semibold">{name}</p>
            <p className="mt-2 text-sm text-neutral-300">{formatCOP(amountValue)} · {FREQUENCY_LABEL[frequency]}</p>
            <p className="mt-2 text-xs text-neutral-400">Próximo cobro: {formatLongDate(date)}{isService ? ` a ${formatLongDate(until)}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className={PRIMARY}>Listo, ver mis cobros →</button>
          <button type="button" onClick={onCreateAnother} className="mt-2 min-h-12 w-full text-sm font-medium text-neutral-400 hover:text-brand">Crear {isService ? 'otro servicio' : 'otra suscripción'}</button>
        </div> : <form action={action} onSubmit={event => { if (step === 1) { event.preventDefault(); if (canContinue) setStep(2) } }} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="name" value={name.trim()} />
          <input type="hidden" name="amount" value={amountValue.toFixed(2)} />
          <input type="hidden" name="frequency" value={frequency} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7">
          <fieldset disabled={pending} className="min-w-0 space-y-5">
            {step === 1 && <>
              <div>
                <label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium">Nombre {isService ? 'del servicio' : 'de la suscripción'}</label>
                <input id={`${id}-name`} required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder={isService ? 'Ej. Agua, energía o internet' : 'Ej. Netflix, Spotify o tu gimnasio'} className={FIELD} />
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Ideas de suscripciones">
                  {(isService ? ['Agua', 'Energía', 'Internet', 'Gas'] : ['Netflix', 'Spotify', 'Disney+', 'Gimnasio']).map(service => <button key={service} type="button" onClick={() => setName(service)} className="min-h-9 rounded-full border border-white/[0.08] px-3 text-xs text-neutral-400 hover:border-brand/40 hover:text-brand">{service}</button>)}
              </div>
              </div>
              <div>
                <label htmlFor={`${id}-amount`} className="mb-2 block text-sm font-medium">{isService ? 'Costo aproximado de cada cobro' : '¿Cuánto pagas en cada cobro?'}</label>
                <AmountField id={`${id}-amount`} name="amount_entry" value={amount} onChange={setAmount} label="Monto del cobro" />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">¿Cada cuánto se repite?</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FREQUENCIES.map(value => <label key={value} className="cursor-pointer">
                    <input type="radio" name="frequency_choice" checked={frequency === value} onChange={() => setFrequency(value)} className="peer sr-only" />
                    <span className="flex min-h-12 items-center justify-center rounded-xl border border-white/[0.07] px-2 py-3 text-center text-xs text-neutral-300 peer-checked:border-brand/50 peer-checked:bg-brand/[0.08] peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{FREQUENCY_LABEL[value]}</span>
                  </label>)}
                </div>
              </fieldset>
              {isService && <p className="text-xs leading-relaxed text-neutral-500">El costo puede variar. Al registrar el gasto podrás poner el monto real.</p>}
              {amountValue > 0 && <p className="text-xs text-neutral-500">Equivale a {formatCOP(monthlyEquivalent(amountValue, frequency))} al mes.</p>}
            </>}
            {step === 2 && <>
              <div className="rounded-2xl border border-brand/20 bg-brand/[0.05] p-4">
                <p className="break-words font-semibold">{name}</p>
                <p className="mt-1 text-sm text-brand">{formatCOP(amountValue)} · {FREQUENCY_LABEL[frequency]}</p>
              </div>
              <div>
                <label htmlFor={`${id}-account`} className="mb-2 block text-sm font-medium">¿De qué cuenta lo pagas? {isService && <span className="text-neutral-500">(opcional)</span>}</label>
                <select id={`${id}-account`} name="account_id" required={!isService} value={accountId} onChange={event => setAccountId(event.target.value)} className={FIELD}>
                  <option value="">{isService ? 'Elegir al registrar el gasto' : 'Elige una cuenta'}</option>
                  {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{isService ? 'Rango del próximo pago' : '¿Cuándo es el próximo cobro?'}</p>
                {isService && <p className="mb-1 text-xs text-neutral-500">Desde</p>}
                <DateTextField name="next_charge_on" required value={date} onChange={setDate} label={isService ? 'Inicio del rango de pago' : 'Próximo cobro'} />
                {isService && <div className="mt-3"><p className="mb-1 text-xs text-neutral-500">Hasta</p><DateTextField name="next_charge_until" required value={until} onChange={setUntil} label="Final del rango de pago" /></div>}
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">{isService ? 'El recordatorio aparecerá al comenzar el rango. Puedes ajustar el monto al pagar.' : 'Ese día aparecerá como pendiente de registrar en Nexo.'}</p>
              </div>
              <div>
                <label htmlFor={`${id}-category`} className="mb-2 block text-sm font-medium">Categoría <span className="text-neutral-500">(opcional)</span></label>
                <select id={`${id}-category`} name="category_id" value={categoryId} onChange={event => setCategoryId(event.target.value)} className={FIELD}>
                  <option value="">Sin categoría</option>
                  {expenseCategories.map(category => <option key={category.id} value={category.id}>{category.parent_id ? `${categoryNames.get(category.parent_id) ?? ''} → ` : ''}{category.name}</option>)}
                </select>
              </div>
              <details className="rounded-2xl border border-white/[0.06] p-4">
                <summary className="cursor-pointer text-sm text-neutral-400">Agregar una nota</summary>
                <textarea name="note" aria-label="Nota opcional" value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="Ej. Plan familiar" className={`${FIELD} mt-3 resize-y`} />
              </details>
              {isService && until < date && <p role="alert" className="text-xs text-red-400">El final del rango debe ser igual o posterior al inicio.</p>}
              {accountName && <p className="break-words text-xs text-neutral-500">Se registrará en {accountName} cuando confirmes el cobro.</p>}
            </>}
          </fieldset>
          </div>
          <footer className="relative z-10 shrink-0 border-t border-white/[0.06] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
            {state && !state.ok && <p role="alert" className="mb-3 rounded-xl bg-red-400/5 p-3 text-sm text-red-400">{state.message}</p>}
            {step === 1 ? <button type="button" disabled={!canContinue} onClick={() => setStep(2)} className={PRIMARY}>Continuar →</button> : <div className="flex gap-3">
              <button type="button" disabled={pending} onClick={() => setStep(1)} className="min-h-12 rounded-2xl border border-white/[0.08] px-4 text-sm text-neutral-400 disabled:opacity-40">Atrás</button>
              <button type="submit" disabled={pending || (!isService && !accountId) || !date || (isService && (!until || until < date))} className={PRIMARY}>{pending ? 'Creando…' : `Crear ${noun} →`}</button>
            </div>}
          </footer>
        </form>}
      </div>
    </div>
  </dialog>
}

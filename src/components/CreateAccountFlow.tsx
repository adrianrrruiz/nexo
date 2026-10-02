'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { createAccount, type AccountState } from '@/app/(app)/cuentas/actions'
import AmountField from '@/components/AmountField'
import AccountAvatar from '@/components/AccountAvatar'
import { BANK_LABEL, SUPPORTED_BANKS } from '@/lib/banks'
import { formatCOP } from '@/lib/format'
import type { AccountType, SupportedBank } from '@/lib/supabase/types'

const TYPES: { value: AccountType; label: string; description: string; path: React.ReactNode }[] = [
  { value: 'debit', label: 'Débito', description: 'Tu dinero del día a día', path: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18" /></> },
  { value: 'credit', label: 'Crédito', description: 'Tu tarjeta y su cupo', path: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M7 15h4M16 15h1" /></> },
]
const FIELD = 'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-base outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/10'
const PRIMARY = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-deep px-5 py-3.5 text-sm font-semibold text-neutral-950 transition-opacity disabled:opacity-40'

export default function CreateAccountButton() {
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-950">+ Crear cuenta</button>
    {open && <CreateAccountDialog key={attempt} onClose={() => setOpen(false)} onCreateAnother={() => setAttempt((current) => current + 1)} />}
  </>
}

function CreateAccountDialog({ onClose, onCreateAnother }: { onClose: () => void; onCreateAnother: () => void }) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [type, setType] = useState<AccountType>('debit')
  const [bank, setBank] = useState<SupportedBank | ''>('')
  const [name, setName] = useState<string | null>(null)
  const [balance, setBalance] = useState('0')
  const [negativeBalance, setNegativeBalance] = useState(false)
  const [limit, setLimit] = useState('')
  const [state, action, pending] = useActionState<AccountState, FormData>(createAccount, null)
  const typeLabel = TYPES.find((item) => item.value === type)!.label
  const accountName = name ?? (bank ? `${BANK_LABEL[bank]} · ${typeLabel}` : '')
  const openingBalance = (Number(balance || '0') / 100) * (type === 'credit' || negativeBalance ? -1 : 1)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    titleRef.current?.focus()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])
  useEffect(() => {
    if (state?.ok || step === 1) titleRef.current?.focus()
    else nameRef.current?.focus()
  }, [step, state?.ok])

  return (
    <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={(event) => { if (pending) event.preventDefault(); else onClose() }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-neutral-100 backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <div className="flex h-full items-end justify-center sm:items-center sm:p-5">
        <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-surface shadow-2xl shadow-black/50 sm:rounded-[28px]">
          <div className="shrink-0 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Tus finanzas, a tu manera</p>
                <h2 ref={titleRef} id={`${id}-title`} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{state?.ok ? 'Tu cuenta está lista' : step === 1 ? 'Crea tu cuenta' : 'Dale tu toque'}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{state?.ok ? 'Ya puedes registrar sus ingresos y gastos.' : step === 1 ? 'Empieza por el tipo de cuenta y el banco.' : 'Ponle un nombre y dinos desde qué saldo empezar.'}</p>
              </div>
              <button type="button" disabled={pending} onClick={onClose} aria-label="Cerrar creación de cuenta" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-neutral-400 transition-colors hover:text-white disabled:opacity-40">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {!state?.ok && <ol aria-label="Pasos para crear una cuenta" className="mt-5 flex gap-3 text-xs font-medium">
              {['Tipo y banco', 'Nombre y saldo'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 ${step === index + 1 ? 'border-brand/20 bg-brand/[0.08] text-brand' : 'border-white/[0.05] text-neutral-500'}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">{step > index + 1 ? '✓' : index + 1}</span>{label}</li>)}
            </ol>}
          </div>
          {state?.ok ? <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7">
            <div className="mb-5 rounded-3xl border border-brand/20 bg-brand/[0.06] p-5">
              <span aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-2xl text-brand">✓</span>
              <p className="break-words text-lg font-semibold">{accountName}</p>
              <p className="mt-1 text-sm text-neutral-400">{bank && BANK_LABEL[bank]} · {typeLabel}</p>
            </div>
            <button type="button" onClick={onClose} className={PRIMARY}>Listo, ver mis cuentas →</button>
            <button type="button" onClick={onCreateAnother} className="mt-2 min-h-12 w-full rounded-2xl text-sm font-medium text-neutral-400 hover:bg-white/[0.04] hover:text-brand">Crear otra cuenta</button>
          </div> : <form action={action} onSubmit={(event) => { if (step === 1) { event.preventDefault(); if (bank) setStep(2) } }} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="bank" value={bank} />
            <input type="hidden" name="initial_balance" value={openingBalance.toFixed(2)} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7">
            <fieldset disabled={pending} className="min-w-0">
              {step === 1 ? <>
                <fieldset>
                  <legend className="mb-3 text-sm font-medium text-neutral-300">¿Qué cuenta quieres organizar?</legend>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TYPES.map((item) => <label key={item.value} className="relative cursor-pointer">
                      <input type="radio" name="account_type_choice" value={item.value} checked={type === item.value} onChange={() => { setType(item.value); setBalance('0'); setNegativeBalance(false) }} className="peer sr-only" />
                      <span className="flex h-full min-h-28 flex-col gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition-colors peer-checked:border-brand/50 peer-checked:bg-brand/[0.08] peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{item.path}</svg>
                        <span className="text-sm font-semibold">{item.label}</span><span className="text-[11px] leading-relaxed text-neutral-400">{item.description}</span>
                      </span>
                    </label>)}
                  </div>
                </fieldset>
                <fieldset className="mt-5">
                  <legend className="mb-3 text-sm font-medium text-neutral-300">¿En qué banco está?</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SUPPORTED_BANKS.map((item) => <label key={item.value} className="cursor-pointer">
                      <input type="radio" name="account_bank_choice" value={item.value} checked={bank === item.value} onChange={() => setBank(item.value)} className="peer sr-only" />
                      <span className="flex h-full min-h-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-3 text-center text-xs font-medium text-neutral-300 transition-colors peer-checked:border-brand/50 peer-checked:bg-brand/[0.08] peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{item.label}</span>
                    </label>)}
                  </div>
                </fieldset>
                {!bank && <p className="mt-3 text-xs text-neutral-500">Elige un banco para continuar.</p>}
              </> : <>
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/15 bg-brand/[0.04] p-4">
                  <AccountAvatar name={accountName || 'Tu cuenta'} type={type} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{accountName || 'Tu cuenta'}</p><p className="mt-1 text-xs text-neutral-500">{bank && BANK_LABEL[bank]} · {typeLabel}</p></div>
                  <div className="w-full text-right sm:w-auto"><p className="text-[10px] text-neutral-500">{type === 'credit' ? 'Deuda actual' : 'Saldo inicial'}</p><p className="mt-1 text-sm font-semibold tabular-nums text-brand">{formatCOP(type === 'credit' ? Math.abs(openingBalance) : openingBalance)}</p></div>
                </div>
                <label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium text-neutral-300">¿Cómo quieres llamarla?</label>
                <input ref={nameRef} id={`${id}-name`} name="name" required maxLength={100} value={accountName} onChange={(event) => setName(event.target.value)} placeholder="Ej. Mi cuenta del día a día" className={FIELD} aria-describedby={`${id}-name-hint`} />
                <p id={`${id}-name-hint`} className="mt-2 text-xs leading-relaxed text-neutral-500">Este es el nombre que verás al registrar un movimiento.</p>
                <div className="mt-5">
                  <label htmlFor={`${id}-balance`} className="mb-2 block text-sm font-medium text-neutral-300">{type === 'credit' ? '¿Cuánto debes hoy?' : '¿Cuánto dinero tienes hoy?'}</label>
                  <AmountField id={`${id}-balance`} name="opening_amount" value={balance} onChange={setBalance} label={type === 'credit' ? 'Deuda actual' : 'Saldo inicial'} describedBy={`${id}-balance-hint`} />
                  <p id={`${id}-balance-hint`} className="mt-2 text-xs leading-relaxed text-neutral-500">{type === 'credit' ? 'Escribe tu deuda como un monto positivo. Nexo la mostrará como saldo negativo. Si no debes nada, deja $ 0,00.' : 'Será el punto de partida de tus movimientos. Si quieres empezar desde cero, deja $ 0,00.'}</p>
                </div>
                {type !== 'credit' && <label className="mt-3 flex min-h-10 items-center gap-2 text-xs text-neutral-400">
                  <input type="checkbox" checked={negativeBalance} onChange={(event) => setNegativeBalance(event.target.checked)} className="h-4 w-4 accent-brand" />
                  El saldo de esta cuenta es negativo
                </label>}
                {type === 'credit' && <div className="mt-5">
                  <label htmlFor={`${id}-limit`} className="mb-2 block text-sm font-medium text-neutral-300">Cupo aprobado <span className="font-normal text-neutral-500">(opcional)</span></label>
                  <AmountField id={`${id}-limit`} name="credit_limit" value={limit} onChange={setLimit} label="Cupo aprobado" required={false} describedBy={`${id}-limit-hint`} />
                  <p id={`${id}-limit-hint`} className="mt-2 text-xs leading-relaxed text-neutral-500">El cupo total que te aprobó el banco.</p>
                </div>}
              </>}
            </fieldset>
            </div>
            <div className="relative z-10 shrink-0 border-t border-white/[0.06] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
              {state && !state.ok && <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-400">{state.message}</p>}
              {step === 1 ? <button type="button" disabled={!bank} onClick={() => setStep(2)} className={PRIMARY}>Continuar <span aria-hidden="true">→</span></button> : <div className="flex gap-3">
                <button type="button" disabled={pending} onClick={() => setStep(1)} className="min-h-12 rounded-2xl border border-white/[0.08] px-4 text-sm font-medium text-neutral-400 hover:text-white disabled:opacity-40">Atrás</button>
                <button type="submit" disabled={pending} className={PRIMARY}>{pending ? 'Creando tu cuenta…' : 'Crear cuenta'}{!pending && <span aria-hidden="true">→</span>}</button>
              </div>}
            </div>
          </form>}
        </div>
      </div>
    </dialog>
  )
}

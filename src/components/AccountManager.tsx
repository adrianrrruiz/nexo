'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  archiveAccount,
  createAccount,
  updateAccount,
  type AccountState,
} from '@/app/(app)/cuentas/actions'
import type { AccountBalance, AccountType } from '@/lib/supabase/types'

const FIELD =
  'w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-base outline-none focus:border-brand/60'

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'debit', label: 'Débito' },
  { value: 'savings', label: 'Ahorros' },
  { value: 'credit', label: 'Crédito' },
  { value: 'cash', label: 'Efectivo' },
]

export function NewAccountButton() {
  return <AccountForm mode="create" />
}

export function EditAccountButton({ account }: { account: AccountBalance }) {
  return <AccountForm mode="edit" account={account} />
}

function AccountForm({
  mode,
  account,
}: {
  mode: 'create' | 'edit'
  account?: AccountBalance
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AccountType>(account?.type ?? 'debit')
  const [state, action, pending] = useActionState<AccountState, FormData>(
    mode === 'create' ? createAccount : updateAccount,
    null
  )
  const [archiveState, archiveAction, archiving] = useActionState<AccountState, FormData>(
    archiveAccount,
    null
  )

  useEffect(() => {
    if (state?.ok || archiveState?.ok) {
      const t = setTimeout(() => setOpen(false), 600)
      return () => clearTimeout(t)
    }
  }, [state, archiveState])

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setType(account?.type ?? 'debit')
          setOpen(true)
        }}
        className={
          mode === 'create'
            ? 'rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-950'
            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-400 transition-colors hover:text-brand'
        }
        aria-label={mode === 'create' ? 'Nueva cuenta' : 'Editar cuenta'}
      >
        {mode === 'create' ? (
          'Nueva'
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15.5 5.5 3 3M4 20l4.2-1 10.3-10.3a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-8">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 lg:rounded-[28px] lg:border">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === 'create' ? 'Nueva cuenta' : 'Editar cuenta'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400"
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form action={action} className="space-y-3">
              {account && <input type="hidden" name="id" value={account.id} />}
              <input
                name="name"
                required
                defaultValue={account?.name ?? ''}
                placeholder="Nombre"
                className={FIELD}
              />
              <select
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as AccountType)}
                className={FIELD}
              >
                {TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {mode === 'create' && (
                <input
                  name="initial_balance"
                  inputMode="decimal"
                  placeholder="Saldo inicial"
                  className={FIELD}
                />
              )}
              {type === 'credit' && (
                <input
                  name="credit_limit"
                  inputMode="decimal"
                  defaultValue={account?.credit_limit ?? ''}
                  placeholder="Cupo aprobado"
                  className={FIELD}
                />
              )}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 disabled:opacity-60"
              >
                {pending ? 'Guardando...' : 'Guardar'}
              </button>
              {state && (
                <p className={`text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}>
                  {state.message}
                </p>
              )}
            </form>

            {account && (
              <form
                action={archiveAction}
                onSubmit={(event) => {
                  if (!confirm('¿Archivar esta cuenta?')) event.preventDefault()
                }}
                className="mt-3"
              >
                <input type="hidden" name="id" value={account.id} />
                <button
                  type="submit"
                  disabled={archiving}
                  className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 disabled:opacity-60"
                >
                  {archiving ? 'Archivando...' : 'Archivar cuenta'}
                </button>
                {archiveState && !archiveState.ok && (
                  <p className="mt-2 text-center text-sm text-red-400">
                    {archiveState.message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

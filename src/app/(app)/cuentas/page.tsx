import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAccountImageUrlMap } from '@/lib/account-images'
import { formatCOP } from '@/lib/format'
import AccountAvatar from '@/components/AccountAvatar'
import AccountImageUploader from '@/components/AccountImageUploader'
import { EditAccountButton, NewAccountButton } from '@/components/AccountManager'
import type { AccountBalance, AccountType } from '@/lib/supabase/types'
import { BANK_LABEL } from '@/lib/banks'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<AccountType, string> = {
  debit: 'Débito',
  savings: 'Ahorros',
  credit: 'Crédito',
  cash: 'Efectivo',
}

const TYPE_ICON: Record<AccountType, React.ReactNode> = {
  debit: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10.5h18" />
    </>
  ),
  savings: (
    <>
      <path d="M12 3v18" />
      <path d="M17 6.5c0-1.5-2.2-2.5-5-2.5S7 5 7 6.5 9.2 9 12 9s5 1 5 2.5-2.2 2.5-5 2.5-5-1-5-2.5" transform="translate(0 4)" />
    </>
  ),
  credit: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M7 15h4" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2.5" />
      <circle cx="12" cy="12.5" r="2.5" />
    </>
  ),
}

export default async function CuentasPage() {
  const supabase = await createClient()
  const [balancesRes, accountsRes] = await Promise.all([
    supabase.from('account_balances').select('*'),
    supabase.from('accounts').select('id').eq('archived', false),
  ])
  const queryError = balancesRes.error ?? accountsRes.error
  if (queryError) {
    throw new Error(`No se pudieron cargar los saldos de las cuentas: ${queryError.message}`)
  }
  const activeAccountIds = new Set((accountsRes.data ?? []).map((account) => account.id))
  const balances = ((balancesRes.data ?? []) as AccountBalance[]).filter((balance) =>
    activeAccountIds.has(balance.id)
  )
  const imageUrls = await createAccountImageUrlMap(balances.map((b) => b.image_path))

  const total = balances.reduce((s, b) => s + Number(b.balance), 0)

  // agrupa por tipo de cuenta
  const byType = new Map<AccountType, AccountBalance[]>()
  for (const b of balances) {
    const list = byType.get(b.type)
    if (list) list.push(b)
    else byType.set(b.type, [b])
  }

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4 lg:mb-8">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">Cuentas</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Total:{' '}
            <span className="font-semibold text-brand tabular-nums">
              {formatCOP(total)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/categorias"
            aria-label="Gestionar categorías"
            title="Gestionar categorías"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition-colors hover:border-brand/40 hover:text-brand"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h10" />
              <path d="M4 12h8" />
              <path d="M4 17h10" />
              <path d="M18 6v12" />
              <path d="m15.5 8.5 2.5-2.5 2.5 2.5" />
              <path d="m15.5 15.5 2.5 2.5 2.5-2.5" />
            </svg>
          </Link>
          <NewAccountButton />
        </div>
      </header>

      {balances.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">Aún no tienes cuentas.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Usa el botón <span className="font-semibold text-brand">Nueva</span>{' '}
            para crear tu primera cuenta.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-7 xl:grid-cols-2">
          {[...byType.entries()].map(([type, list]) => (
            <section key={type}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {TYPE_LABEL[type] ?? type}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {list.map((b) => (
                  <article
                    key={b.id}
                    className="flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:border-brand/25 hover:bg-white/[0.05]"
                  >
                    <AccountImageUploader accountId={b.id}>
                      {b.image_path ? (
                        <AccountAvatar
                          name={b.name}
                          type={b.type}
                          imageUrl={imageUrls.get(b.image_path)}
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            {TYPE_ICON[b.type]}
                          </svg>
                        </span>
                      )}
                    </AccountImageUploader>
                    <Link
                      href={`/movimientos?cuenta=${b.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-label={`Ver movimientos de ${b.name}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-neutral-500">
                          {BANK_LABEL[b.bank]} ·{' '}
                          {b.type === 'credit' && b.credit_limit
                            ? `Cupo ${formatCOP(Number(b.credit_limit))}`
                            : b.currency}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          Number(b.balance) < 0 ? 'text-red-400' : 'text-neutral-100'
                        }`}
                      >
                        {formatCOP(Number(b.balance))}
                      </p>
                    </Link>
                    <Link
                      href={`/cuentas/${b.id}/extractos`}
                      aria-label={`Ver extractos de ${b.name}`}
                      title="Extractos"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-400 transition-colors hover:text-brand"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                        <path d="M14 3v5h5M8 14h8M8 17h6" />
                      </svg>
                    </Link>
                    <EditAccountButton account={b} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

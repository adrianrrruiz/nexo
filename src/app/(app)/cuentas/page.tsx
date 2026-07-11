import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/format'
import type { AccountBalance, AccountType } from '@/lib/supabase/types'

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
  const { data } = await supabase.from('account_balances').select('*')
  const balances = (data ?? []) as AccountBalance[]

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
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Cuentas</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Total:{' '}
          <span className="font-semibold text-brand tabular-nums">
            {formatCOP(total)}
          </span>
        </p>
      </header>

      {balances.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">Aún no tienes cuentas.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Importa tu historial con{' '}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-neutral-300">
              npm run import
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {[...byType.entries()].map(([type, list]) => (
            <section key={type}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {TYPE_LABEL[type] ?? type}
              </h2>
              <div className="space-y-3">
                {list.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4"
                  >
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-neutral-500">
                        {b.type === 'credit' && b.credit_limit
                          ? `Cupo ${formatCOP(Number(b.credit_limit))}`
                          : b.currency}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        Number(b.balance) < 0 ? 'text-red-400' : 'text-neutral-100'
                      }`}
                    >
                      {formatCOP(Number(b.balance))}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

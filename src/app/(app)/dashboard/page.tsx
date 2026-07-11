import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatDay, currentMonthRange } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import Logo from '@/components/Logo'
import TransactionRow, { TX_META } from '@/components/TransactionRow'
import type {
  AccountBalance,
  Account,
  Category,
  Transaction,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { start, end } = currentMonthRange()

  const [balancesRes, accountsRes, categoriesRes, recentRes, monthRes] =
    await Promise.all([
      supabase.from('account_balances').select('*'),
      supabase.from('accounts').select('id,name,type').eq('archived', false),
      supabase.from('categories').select('id,name,kind,parent_id'),
      supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(8),
      supabase
        .from('transactions')
        .select('amount,type,category_id')
        .gte('occurred_at', start)
        .lt('occurred_at', end),
    ])

  const balances = (balancesRes.data ?? []) as AccountBalance[]
  const accounts = (accountsRes.data ?? []) as Pick<Account, 'id' | 'name' | 'type'>[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]
  const recent = (recentRes.data ?? []) as Transaction[]
  const month = (monthRes.data ?? []) as Pick<
    Transaction,
    'amount' | 'type' | 'category_id'
  >[]

  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const netWorth = balances.reduce((s, b) => s + Number(b.balance), 0)
  const monthIncome = month
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = month
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

  // gasto del mes por categoría
  const spendByCat = new Map<string, number>()
  for (const t of month) {
    if (t.type !== 'expense') continue
    const key = t.category_id ? categoryName.get(t.category_id) ?? 'Sin categoría' : 'Sin categoría'
    spendByCat.set(key, (spendByCat.get(key) ?? 0) + Number(t.amount))
  }
  const topSpend = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxSpend = topSpend[0]?.[1] ?? 1

  const noData = balances.length === 0
  const firstName = user?.email?.split('@')[0] ?? 'Nexo'

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" id="nexo-logo-dash" />
          <div>
            <p className="text-xs text-neutral-500">Hola,</p>
            <h1 className="text-base font-semibold leading-tight">{firstName}</h1>
          </div>
        </div>
        <Link
          href="/perfil"
          aria-label="Perfil"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold text-brand"
        >
          {firstName.charAt(0).toUpperCase()}
        </Link>
      </header>

      {/* Patrimonio neto */}
      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand to-brand-deep p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-950/60">
          Patrimonio neto
        </p>
        <p className="mt-1.5 text-4xl font-bold tracking-tight text-neutral-950">
          {formatCOP(netWorth)}
        </p>
        <div className="mt-5 flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-black/15 px-3 py-1.5 text-emerald-950">
            ↑ {formatCOP(monthIncome)}
          </span>
          <span className="rounded-full bg-black/15 px-3 py-1.5 text-red-950">
            ↓ {formatCOP(monthExpense)}
          </span>
          <span className="ml-auto text-emerald-950/60">este mes</span>
        </div>
      </section>

      {noData ? (
        <EmptyState />
      ) : (
        <>
          {/* Cuentas */}
          <SectionHeader title="Cuentas" href="/cuentas" />
          <div className="no-scrollbar mb-7 flex gap-3 overflow-x-auto pb-1">
            {balances.map((b) => (
              <div
                key={b.id}
                className="min-w-[148px] rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <p className="truncate text-xs text-neutral-400">{b.name}</p>
                <p
                  className={`mt-1.5 text-sm font-semibold tabular-nums ${
                    Number(b.balance) < 0 ? 'text-red-400' : 'text-neutral-100'
                  }`}
                >
                  {formatCOP(Number(b.balance))}
                </p>
                <p className="mt-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                  {b.type}
                </p>
              </div>
            ))}
          </div>

          {/* Gasto por categoría */}
          {topSpend.length > 0 && (
            <>
              <SectionHeader title="Gasto del mes" />
              <div className="mb-7 space-y-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                {topSpend.map(([name, amount]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-300">{name}</span>
                      <span className="tabular-nums text-neutral-500">
                        {formatCOP(amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-deep"
                        style={{ width: `${(amount / maxSpend) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Movimientos recientes */}
          <SectionHeader title="Recientes" href="/movimientos" />
          <ul className="divide-y divide-white/[0.05]">
            {recent.map((t) => {
              const meta = TX_META[t.type]
              const label =
                t.type === 'transfer'
                  ? `${accountName.get(t.account_id) ?? ''} → ${
                      t.to_account_id ? accountName.get(t.to_account_id) ?? '' : ''
                    }`
                  : t.category_id
                    ? categoryName.get(t.category_id) ?? meta.label
                    : meta.label
              return (
                <TransactionRow
                  key={t.id}
                  type={t.type}
                  label={label}
                  sublabel={`${accountName.get(t.account_id) ?? ''} · ${formatDay(
                    t.occurred_at
                  )}${t.note ? ` · ${t.note}` : ''}`}
                  amount={Number(t.amount)}
                />
              )
            })}
          </ul>
        </>
      )}

      <QuickEntry accounts={accounts} categories={categories} />
    </>
  )
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-medium text-brand">
          Ver todo
        </Link>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
      <p className="text-neutral-300">Aún no hay datos.</p>
      <p className="mt-2 text-sm text-neutral-500">
        Importa tu historial con{' '}
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-neutral-300">
          npm run import
        </code>{' '}
        o toca el botón <span className="font-semibold text-brand">+</span> para tu
        primer movimiento.
      </p>
    </div>
  )
}

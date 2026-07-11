import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatDay, currentMonthRange } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import type {
  AccountBalance,
  Account,
  Category,
  Transaction,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const TYPE_META: Record<string, { sign: string; color: string; label: string }> = {
  income: { sign: '+', color: 'text-emerald-400', label: 'Ingreso' },
  expense: { sign: '−', color: 'text-red-400', label: 'Gasto' },
  transfer: { sign: '', color: 'text-sky-400', label: 'Transferencia' },
  adjustment: { sign: '', color: 'text-amber-400', label: 'Ajuste' },
}

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
        .limit(25),
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
  const topSpend = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxSpend = topSpend[0]?.[1] ?? 1

  const noData = balances.length === 0

  return (
    <main className="flex-1 px-4 pb-28 pt-4 max-w-md mx-auto w-full">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500">Hola{user?.email ? ',' : ''}</p>
          <h1 className="text-lg font-semibold">{user?.email ?? 'Nexo'}</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-neutral-400 underline">Salir</button>
        </form>
      </header>

      {/* Patrimonio neto */}
      <section className="mb-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5">
        <p className="text-xs text-indigo-100">Patrimonio neto</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatCOP(netWorth)}</p>
        <div className="mt-4 flex gap-4 text-sm">
          <span className="text-emerald-200">↑ {formatCOP(monthIncome)}</span>
          <span className="text-red-200">↓ {formatCOP(monthExpense)}</span>
          <span className="ml-auto text-indigo-100">este mes</span>
        </div>
      </section>

      {noData ? (
        <EmptyState />
      ) : (
        <>
          {/* Cuentas */}
          <SectionTitle>Cuentas</SectionTitle>
          <div className="mb-6 flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {balances.map((b) => (
              <div
                key={b.id}
                className="min-w-[140px] rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
              >
                <p className="truncate text-sm text-neutral-400">{b.name}</p>
                <p
                  className={`mt-1 font-semibold ${
                    Number(b.balance) < 0 ? 'text-red-400' : ''
                  }`}
                >
                  {formatCOP(Number(b.balance))}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-600">
                  {b.type}
                </p>
              </div>
            ))}
          </div>

          {/* Gasto por categoría */}
          {topSpend.length > 0 && (
            <>
              <SectionTitle>Gasto del mes por categoría</SectionTitle>
              <div className="mb-6 space-y-2">
                {topSpend.map(([name, amount]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-300">{name}</span>
                      <span className="text-neutral-400">{formatCOP(amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${(amount / maxSpend) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Movimientos recientes */}
          <SectionTitle>Movimientos recientes</SectionTitle>
          <ul className="divide-y divide-neutral-900">
            {recent.map((t) => {
              const meta = TYPE_META[t.type]
              const label =
                t.type === 'transfer'
                  ? `${accountName.get(t.account_id) ?? ''} → ${
                      t.to_account_id ? accountName.get(t.to_account_id) ?? '' : ''
                    }`
                  : t.category_id
                    ? categoryName.get(t.category_id) ?? meta.label
                    : meta.label
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{label}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {accountName.get(t.account_id)} · {formatDay(t.occurred_at)}
                      {t.note ? ` · ${t.note}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${meta.color}`}>
                    {meta.sign}
                    {formatCOP(Number(t.amount))}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <QuickEntry accounts={accounts} categories={categories} />
    </main>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
      {children}
    </h2>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
      <p className="text-neutral-400">Aún no hay datos.</p>
      <p className="mt-2 text-sm text-neutral-500">
        Importa tu historial con{' '}
        <code className="rounded bg-neutral-800 px-1">npm run import</code> o toca el
        botón <span className="text-indigo-400">+</span> para tu primer movimiento.
      </p>
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatDay, currentMonthRange } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import Logo from '@/components/Logo'
import TransactionRow from '@/components/TransactionRow'
import DeveloperFooter from '@/components/DeveloperFooter'
import { createAccountImageUrlMap, createProfileAvatarUrl } from '@/lib/account-images'
import {
  categoryGroupId,
  categoryLabel,
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_LABEL,
} from '@/lib/categories'
import { getTransactionMeta } from '@/lib/transaction-meta'
import type {
  AccountBalance,
  Account,
  Category,
  Profile,
  Transaction,
  TransactionType,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { start, end } = currentMonthRange()

  const [profileRes, balancesRes, accountsRes, categoriesRes, recentRes, monthRes] =
    await Promise.all([
      user
        ? supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('account_balances').select('*'),
      supabase.from('accounts').select('id,name,type,image_path').eq('archived', false),
      user
        ? supabase.from('categories').select('id,name,kind,parent_id').eq('user_id', user.id)
        : Promise.resolve({ data: null }),
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

  const profile = profileRes.data as Profile | null
  const balances = (balancesRes.data ?? []) as AccountBalance[]
  const accounts = (accountsRes.data ?? []) as Pick<
    Account,
    'id' | 'name' | 'type' | 'image_path'
  >[]
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
  const accountType = new Map(accounts.map((a) => [a.id, a.type]))
  const accountImagePath = new Map(accounts.map((a) => [a.id, a.image_path]))
  const accountImageUrl = await createAccountImageUrlMap(accounts.map((a) => a.image_path))
  const profileAvatarUrl = await createProfileAvatarUrl(profile?.avatar_path ?? null)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const categoryParent = new Map(categories.map((c) => [c.id, c.parent_id]))

  const netWorth = balances.reduce((s, b) => s + Number(b.balance), 0)
  const monthIncome = month
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = month
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

  const expenseByCat = new Map<string, number>()
  const incomeByCat = new Map<string, number>()
  for (const t of month) {
    const key = categoryGroupId(t.category_id, categoryParent) ?? UNCATEGORIZED_KEY
    if (t.type === 'expense') {
      expenseByCat.set(key, (expenseByCat.get(key) ?? 0) + Number(t.amount))
    }
    if (t.type === 'income') {
      incomeByCat.set(key, (incomeByCat.get(key) ?? 0) + Number(t.amount))
    }
  }
  const topExpense = toBreakdown(expenseByCat, categoryName)
  const topIncome = toBreakdown(incomeByCat, categoryName)

  const noData = balances.length === 0
  const firstName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Nexo'

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
          className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold text-brand"
        >
          {profileAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            firstName.charAt(0).toUpperCase()
          )}
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
                {b.type === 'credit' && b.credit_limit && (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Cupo:{' '}
                    <span className="tabular-nums">
                      {formatCOP(Number(b.credit_limit))}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Análisis del mes */}
          {(topExpense.length > 0 || topIncome.length > 0) && (
            <>
              <SectionHeader title="Análisis del mes" />
              <div className="mb-7 space-y-3">
                <CategoryBreakdown
                  title="Gastos por categoría"
                  items={topExpense}
                  type="expense"
                />
                <CategoryBreakdown
                  title="Ingresos por categoría"
                  items={topIncome}
                  type="income"
                />
              </div>
            </>
          )}

          {/* Movimientos recientes */}
          <SectionHeader title="Recientes" href="/movimientos" />
          <ul className="divide-y divide-white/[0.05]">
            {recent.map((t) => {
              const meta = getTransactionMeta(t.type)
              const label =
                t.type === 'transfer'
                  ? `${accountName.get(t.account_id) ?? ''} → ${
                      t.to_account_id ? accountName.get(t.to_account_id) ?? '' : ''
                    }`
                  : t.category_id
                    ? categoryLabel(t.category_id, categoryName, categoryParent, meta.label)
                    : meta.label
              const imagePath = accountImagePath.get(t.account_id)
              return (
                <TransactionRow
                  key={t.id}
                  type={t.type}
                  label={label}
                  sublabel={`${accountName.get(t.account_id) ?? ''} · ${formatDay(
                    t.occurred_at
                  )}${t.note ? ` · ${t.note}` : ''}`}
                  amount={Number(t.amount)}
                  accountName={accountName.get(t.account_id)}
                  accountType={accountType.get(t.account_id)}
                  accountImageUrl={imagePath ? accountImageUrl.get(imagePath) : null}
                />
              )
            })}
          </ul>
        </>
      )}

      <DeveloperFooter className="mt-10" />

      <QuickEntry accounts={accounts} categories={categories} />
    </>
  )
}

type BreakdownItem = {
  id: string
  name: string
  amount: number
  percent: number
}

function toBreakdown(
  source: Map<string, number>,
  categoryName: Map<string, string>
): BreakdownItem[] {
  const items = [...source.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({
      id,
      name:
        id === UNCATEGORIZED_KEY
          ? UNCATEGORIZED_LABEL
          : categoryName.get(id) ?? UNCATEGORIZED_LABEL,
      amount,
    }))
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return items.slice(0, 7).map((item) => ({
    ...item,
    percent: total > 0 ? (item.amount / total) * 100 : 0,
  }))
}

function CategoryBreakdown({
  title,
  items,
  type,
}: {
  title: string
  items: BreakdownItem[]
  type: Extract<TransactionType, 'income' | 'expense'>
}) {
  if (items.length === 0) return null
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const color = type === 'income' ? 'bg-brand' : 'bg-red-400'
  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">{title}</h3>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-400">
          {formatCOP(total)}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/movimientos?categoria=${item.id}`}
            aria-label={`Ver movimientos de ${item.name}`}
            className="group -mx-2 block rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-neutral-300 transition-colors group-hover:text-neutral-100">
                {item.name}
              </span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {formatCOP(item.amount)}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.max(item.percent, 3)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
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
        Toca el botón <span className="font-semibold text-brand">+</span> para
        registrar tu primer movimiento.
      </p>
    </div>
  )
}

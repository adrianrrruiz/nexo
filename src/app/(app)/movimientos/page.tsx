import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatDateInputValue, formatDay, formatMonth } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import MovementAccountFilter from '@/components/MovementAccountFilter'
import EditableTransactionRow from '@/components/EditableTransactionRow'
import { createAccountImageUrlMap } from '@/lib/account-images'
import { categoryGroupKey, categoryLabel } from '@/lib/categories'
import { getTransactionMeta } from '@/lib/transaction-meta'
import type { Account, Category, Transaction, TransactionType } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>
}) {
  const supabase = await createClient()
  const { cuenta } = await searchParams
  const selectedAccountId = cuenta ?? ''

  let txQuery = supabase
    .from('transactions')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(150)

  if (selectedAccountId) {
    txQuery = txQuery.or(
      `account_id.eq.${selectedAccountId},to_account_id.eq.${selectedAccountId}`
    )
  }

  const [accountsRes, categoriesRes, txRes] = await Promise.all([
    supabase.from('accounts').select('id,name,type,image_path').eq('archived', false),
    supabase.from('categories').select('id,name,kind,parent_id'),
    txQuery,
  ])

  const accounts = (accountsRes.data ?? []) as Pick<
    Account,
    'id' | 'name' | 'type' | 'image_path'
  >[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]
  const txs = (txRes.data ?? []) as Transaction[]

  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const selectedAccountName = selectedAccountId
    ? accountName.get(selectedAccountId) ?? 'esta cuenta'
    : null
  const accountType = new Map(accounts.map((a) => [a.id, a.type]))
  const accountImagePath = new Map(accounts.map((a) => [a.id, a.image_path]))
  const accountImageUrl = await createAccountImageUrlMap(accounts.map((a) => a.image_path))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const categoryParent = new Map(categories.map((c) => [c.id, c.parent_id]))

  const byMonth = new Map<string, Transaction[]>()
  for (const t of txs) {
    const month = t.occurred_at.slice(0, 7)
    const list = byMonth.get(month)
    if (list) list.push(t)
    else byMonth.set(month, [t])
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          {selectedAccountName
            ? `${txs.length} registros de ${selectedAccountName}`
            : `Tus últimos ${txs.length} registros`}
        </p>
      </header>

      <div className="mb-5">
        <MovementAccountFilter
          accounts={accounts}
          selectedAccountId={selectedAccountId}
        />
      </div>

      {txs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">
            {selectedAccountName
              ? 'Sin movimientos para esta cuenta.'
              : 'Sin movimientos todavía.'}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Toca el botón <span className="font-semibold text-brand">+</span> para
            registrar el primero.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month} className="space-y-3">
              <MonthSummary
                month={list[0]?.occurred_at ?? `${month}-01T12:00:00-05:00`}
                transactions={list}
                categoryName={categoryName}
                categoryParent={categoryParent}
              />
              <MonthTransactionList
                transactions={list}
                accounts={accounts}
                categories={categories}
                accountName={accountName}
                accountType={accountType}
                accountImagePath={accountImagePath}
                accountImageUrl={accountImageUrl}
                categoryName={categoryName}
                categoryParent={categoryParent}
              />
            </section>
          ))}
        </div>
      )}

      <QuickEntry accounts={accounts} categories={categories} />
    </>
  )
}

function MonthSummary({
  month,
  transactions,
  categoryName,
  categoryParent,
}: {
  month: string
  transactions: Transaction[]
  categoryName: Map<string, string>
  categoryParent: Map<string, string | null>
}) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expenseByCat = collectByCategory(transactions, categoryName, categoryParent, 'expense')
  const incomeByCat = collectByCategory(transactions, categoryName, categoryParent, 'income')

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold capitalize text-neutral-100">
            {formatMonth(month)}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {transactions.length} movimientos
          </p>
        </div>
        <div className="text-right text-xs font-semibold tabular-nums">
          <p className="text-brand">+{formatCOP(income)}</p>
          <p className="mt-1 text-red-400">-{formatCOP(expense)}</p>
        </div>
      </div>
      <div className="space-y-4">
        <MiniBreakdown title="Gastos" items={expenseByCat} type="expense" />
        <MiniBreakdown title="Ingresos" items={incomeByCat} type="income" />
      </div>
    </div>
  )
}

function MonthTransactionList({
  transactions,
  accounts,
  categories,
  accountName,
  accountType,
  accountImagePath,
  accountImageUrl,
  categoryName,
  categoryParent,
}: {
  transactions: Transaction[]
  accounts: Pick<Account, 'id' | 'name' | 'type' | 'image_path'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
  accountName: Map<string, string>
  accountType: Map<string, Account['type']>
  accountImagePath: Map<string, string | null>
  accountImageUrl: Map<string, string>
  categoryName: Map<string, string>
  categoryParent: Map<string, string | null>
}) {
  const byDay = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const day = formatDateInputValue(t.occurred_at)
    const list = byDay.get(day)
    if (list) list.push(t)
    else byDay.set(day, [t])
  }

  return (
    <div className="space-y-5">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {formatDay(list[0]?.occurred_at ?? `${day}T12:00:00-05:00`)}
            </h3>
            <QuickEntry
              accounts={accounts}
              categories={categories}
              defaultDate={day}
              trigger={
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand/10">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              }
            />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {list.map((t) => {
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
                <EditableTransactionRow
                  key={t.id}
                  transaction={t}
                  accounts={accounts}
                  categories={categories}
                  label={label}
                  sublabel={`${accountName.get(t.account_id) ?? ''}${
                    t.note ? ` · ${t.note}` : ''
                  }`}
                  accountName={accountName.get(t.account_id)}
                  accountType={accountType.get(t.account_id)}
                  accountImageUrl={imagePath ? accountImageUrl.get(imagePath) : null}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

type MiniItem = {
  name: string
  amount: number
  percent: number
}

function collectByCategory(
  transactions: Transaction[],
  categoryName: Map<string, string>,
  categoryParent: Map<string, string | null>,
  type: Extract<TransactionType, 'income' | 'expense'>
): MiniItem[] {
  const byCat = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== type) continue
    const key = categoryGroupKey(t.category_id, categoryName, categoryParent)
    byCat.set(key, (byCat.get(key) ?? 0) + Number(t.amount))
  }
  const items = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return items.map((item) => ({
    ...item,
    percent: total > 0 ? (item.amount / total) * 100 : 0,
  }))
}

function MiniBreakdown({
  title,
  items,
  type,
}: {
  title: string
  items: MiniItem[]
  type: Extract<TransactionType, 'income' | 'expense'>
}) {
  if (items.length === 0) return null
  const color = type === 'income' ? 'bg-brand' : 'bg-red-400'
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-neutral-400">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-neutral-300">{item.name}</span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {formatCOP(item.amount)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.max(item.percent, 3)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

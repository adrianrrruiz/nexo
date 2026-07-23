import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatDateInputValue, formatDay, formatMonth } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import MovementAccountFilter from '@/components/MovementAccountFilter'
import EditableTransactionRow from '@/components/EditableTransactionRow'
import { createAccountImageUrlMap } from '@/lib/account-images'
import {
  categoryGroupId,
  categoryIdsInGroup,
  categoryLabel,
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_LABEL,
} from '@/lib/categories'
import { getTransactionMeta } from '@/lib/transaction-meta'
import type { Account, Category, Transaction, TransactionType } from '@/lib/supabase/types'

/** Construye la URL de movimientos filtrada por categoría, conservando la cuenta. */
function categoriaHref(categoriaId: string, accountId: string) {
  const params = new URLSearchParams()
  if (accountId) params.set('cuenta', accountId)
  params.set('categoria', categoriaId)
  return `/movimientos?${params.toString()}`
}

export const dynamic = 'force-dynamic'

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; categoria?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { cuenta, categoria } = await searchParams
  const selectedAccountId = cuenta ?? ''
  const selectedCategoryId = categoria ?? ''

  // Cuentas y categorías primero: el filtro por categoría necesita resolver
  // los ids del grupo (padre + subcategorías) antes de consultar movimientos.
  const [accountsRes, categoriesRes] = await Promise.all([
    supabase.from('accounts').select('id,name,type,image_path').eq('archived', false),
    user
      ? supabase.from('categories').select('id,name,kind,parent_id').eq('user_id', user.id)
      : Promise.resolve({ data: null }),
  ])

  const accounts = (accountsRes.data ?? []) as Pick<
    Account,
    'id' | 'name' | 'type' | 'image_path'
  >[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]

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

  if (selectedCategoryId) {
    if (selectedCategoryId === UNCATEGORIZED_KEY) {
      txQuery = txQuery.is('category_id', null)
    } else {
      const ids = categoryIdsInGroup(selectedCategoryId, categories)
      txQuery = txQuery.in('category_id', ids.length ? ids : [selectedCategoryId])
    }
  }

  const txRes = await txQuery
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
  const selectedCategoryName = selectedCategoryId
    ? selectedCategoryId === UNCATEGORIZED_KEY
      ? UNCATEGORIZED_LABEL
      : categoryName.get(selectedCategoryId) ?? 'esta categoría'
    : null

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
          {selectedCategoryName
            ? `${txs.length} registros en ${selectedCategoryName}`
            : selectedAccountName
              ? `${txs.length} registros de ${selectedAccountName}`
              : `Tus últimos ${txs.length} registros`}
        </p>
      </header>

      <div className="mb-5 space-y-3">
        <MovementAccountFilter
          accounts={accounts}
          selectedAccountId={selectedAccountId}
        />
        {selectedCategoryName && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Categoría:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 py-1 pl-3 pr-1.5 font-medium text-brand">
              {selectedCategoryName}
              <Link
                href={selectedAccountId ? `/movimientos?cuenta=${selectedAccountId}` : '/movimientos'}
                aria-label="Quitar filtro de categoría"
                scroll={false}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-brand/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </Link>
            </span>
          </div>
        )}
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
                accountId={selectedAccountId}
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
  accountId,
}: {
  month: string
  transactions: Transaction[]
  categoryName: Map<string, string>
  categoryParent: Map<string, string | null>
  accountId: string
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
        <MiniBreakdown title="Gastos" items={expenseByCat} type="expense" accountId={accountId} />
        <MiniBreakdown title="Ingresos" items={incomeByCat} type="income" accountId={accountId} />
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
  id: string
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
    const key = categoryGroupId(t.category_id, categoryParent) ?? UNCATEGORIZED_KEY
    byCat.set(key, (byCat.get(key) ?? 0) + Number(t.amount))
  }
  const items = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({
      id,
      name:
        id === UNCATEGORIZED_KEY
          ? UNCATEGORIZED_LABEL
          : categoryName.get(id) ?? UNCATEGORIZED_LABEL,
      amount,
    }))
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
  accountId,
}: {
  title: string
  items: MiniItem[]
  type: Extract<TransactionType, 'income' | 'expense'>
  accountId: string
}) {
  if (items.length === 0) return null
  const color = type === 'income' ? 'bg-brand' : 'bg-red-400'
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-neutral-400">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={categoriaHref(item.id, accountId)}
            aria-label={`Filtrar movimientos por ${item.name}`}
            className="group -mx-2 block rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
          >
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-neutral-300 transition-colors group-hover:text-neutral-100">
                {item.name}
              </span>
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
          </Link>
        ))}
      </div>
    </div>
  )
}

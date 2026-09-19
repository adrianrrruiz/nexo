'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import QuickEntry from '@/components/QuickEntry'
import EditableTransactionRow from '@/components/EditableTransactionRow'
import { loadOlderMovementMonth } from '@/app/(app)/movimientos/actions'
import { formatCOP, formatDateInputValue, formatDay, formatMonth } from '@/lib/format'
import { categoryGroupId, categoryLabel, UNCATEGORIZED_KEY, UNCATEGORIZED_LABEL } from '@/lib/categories'
import { getTransactionMeta } from '@/lib/transaction-meta'
import type { MovementMonth } from '@/lib/movement-history'
import type { Account, Category, Transaction, TransactionType } from '@/lib/supabase/types'

function categoriaHref(categoriaId: string, accountId: string, showReconciled: boolean) {
  const params = new URLSearchParams()
  if (accountId) params.set('cuenta', accountId)
  if (categoriaId) params.set('categoria', categoriaId)
  if (showReconciled) params.set('anteriores', '1')
  return `/movimientos?${params.toString()}`
}

type AccountItem = Pick<Account, 'id' | 'name' | 'type' | 'image_path'>
type CategoryItem = Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>

export default function MovementHistory({
  initialMonth,
  accounts,
  categories,
  imageUrls,
  accountId,
  categoryId,
  showReconciled,
}: {
  initialMonth: MovementMonth
  accounts: AccountItem[]
  categories: CategoryItem[]
  imageUrls: Record<string, string>
  accountId: string
  categoryId: string
  showReconciled: boolean
}) {
  const [pages, setPages] = useState<MovementMonth[]>([initialMonth])
  const [previousInitialMonth, setPreviousInitialMonth] = useState(initialMonth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const loadingRef = useRef(false)
  const generationRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  if (initialMonth !== previousInitialMonth) {
    setPreviousInitialMonth(initialMonth)
    setPages([initialMonth])
    setLoading(false)
    setError(false)
  }
  useEffect(() => {
    generationRef.current += 1
    loadingRef.current = false
  }, [initialMonth])
  const hasMore = pages.at(-1)?.hasMore ?? false

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    const generation = generationRef.current
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const next = await loadOlderMovementMonth({
        accountId,
        categoryId,
        showReconciled,
        beforeMonth: pages.at(-1)!.month,
      })
      if (generation !== generationRef.current) return
      if (next) setPages((current) => [...current, next])
      else setPages((current) => current.map((page, index) =>
        index === current.length - 1 ? { ...page, hasMore: false } : page
      ))
    } catch {
      if (generation === generationRef.current) setError(true)
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [accountId, categoryId, showReconciled, pages, hasMore])

  useEffect(() => {
    if (!hasMore || error || !sentinelRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '500px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, error, loadMore])

  const accountName = new Map(accounts.map((account) => [account.id, account.name]))
  const accountType = new Map(accounts.map((account) => [account.id, account.type]))
  const accountImagePath = new Map(accounts.map((account) => [account.id, account.image_path]))
  const accountImageUrl = new Map(Object.entries(imageUrls))
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const categoryParent = new Map(categories.map((category) => [category.id, category.parent_id]))
  const loadedCount = pages.reduce((count, page) => count + page.transactions.length, 0)

  return (
    <>
      <p className="mb-4 text-xs text-neutral-500" aria-live="polite">
        {loadedCount} movimientos cargados{hasMore ? ' · Baja para ver meses anteriores' : ' · Historial completo'}
      </p>
      <div className="space-y-6">
        {pages.map(({ month, transactions }) => (
          <section
            key={month}
            className="space-y-3 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0"
          >
            <MonthSummary
              month={`${month}-01T12:00:00-05:00`}
              transactions={transactions}
              categoryName={categoryName}
              categoryParent={categoryParent}
              accountId={accountId}
              showReconciled={showReconciled}
            />
            <MonthTransactionList
              transactions={transactions}
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
      {hasMore && (
        <div ref={sentinelRef} className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-2xl border border-white/10 px-5 py-3 text-neutral-200 disabled:opacity-60"
          >
            {loading ? 'Cargando mes anterior...' : 'Cargar mes anterior'}
          </button>
          {error && <p className="text-red-400">No se pudo cargar. Inténtalo de nuevo.</p>}
        </div>
      )}
    </>
  )
}

function MonthSummary({
  month,
  transactions,
  categoryName,
  categoryParent,
  accountId,
  showReconciled,
}: {
  month: string
  transactions: Transaction[]
  categoryName: Map<string, string>
  categoryParent: Map<string, string | null>
  accountId: string
  showReconciled: boolean
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
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 lg:sticky lg:top-8">
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
        <MiniBreakdown
          title="Gastos"
          items={expenseByCat}
          type="expense"
          accountId={accountId}
          showReconciled={showReconciled}
        />
        <MiniBreakdown
          title="Ingresos"
          items={incomeByCat}
          type="income"
          accountId={accountId}
          showReconciled={showReconciled}
        />
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
  showReconciled,
}: {
  title: string
  items: MiniItem[]
  type: Extract<TransactionType, 'income' | 'expense'>
  accountId: string
  showReconciled: boolean
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
            href={categoriaHref(item.id, accountId, showReconciled)}
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

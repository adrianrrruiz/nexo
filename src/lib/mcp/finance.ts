import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { categoryGroupKey, categoryLabel } from '@/lib/categories'
import type {
  Account,
  AccountBalance,
  Category,
  Database,
  Transaction,
  TransactionSource,
  TransactionType,
} from '@/lib/supabase/types'

const MAX_RANGE_DAYS = 366
const DEFAULT_RESULT_LIMIT = 25
const MAX_RESULT_LIMIT = 50
const SUMMARY_PAGE_SIZE = 1_000
const MAX_SUMMARY_ROWS = 20_000

let adminClient: SupabaseClient<Database> | null = null

function getAdminClient() {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !secret) {
    throw new Error('Supabase server credentials are not configured.')
  }

  adminClient = createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  return adminClient
}

function todayInBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function firstDayOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function assertDate(date: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${field} must use YYYY-MM-DD format.`)
  }

  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${field} is not a valid date.`)
  }
}

export function normalizeDateRange(startDate?: string, endDate?: string) {
  const today = todayInBogota()
  const start = startDate ?? (endDate ? firstDayOfMonth(endDate) : firstDayOfMonth(today))
  const end = endDate ?? today

  assertDate(start, 'start_date')
  assertDate(end, 'end_date')

  if (start > end) throw new Error('start_date must be before or equal to end_date.')

  const rangeDays =
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000 +
    1

  if (rangeDays > MAX_RANGE_DAYS) {
    throw new Error(`The maximum date range is ${MAX_RANGE_DAYS} days.`)
  }

  return {
    startDate: start,
    endDate: end,
    startIso: `${start}T00:00:00-05:00`,
    endExclusiveIso: `${addDays(end, 1)}T00:00:00-05:00`,
  }
}

type CategoryBreakdown = {
  category: string
  amount: number
  percentage: number
}

export type FinancialSummary = {
  period: { start_date: string; end_date: string }
  currency: 'COP'
  totals: {
    income: number
    expenses: number
    net_cash_flow: number
    transfers: number
    adjustments: number
  }
  transaction_count: number
  expenses_by_category: CategoryBreakdown[]
  income_by_category: CategoryBreakdown[]
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function toBreakdown(source: Map<string, number>, total: number): CategoryBreakdown[] {
  return [...source.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, amount]) => ({
      category,
      amount: roundMoney(amount),
      percentage: total > 0 ? Math.round((amount / total) * 10_000) / 100 : 0,
    }))
}

async function loadCategories(userId: string) {
  const { data, error } = await getAdminClient()
    .from('categories')
    .select('id,name,parent_id')
    .eq('user_id', userId)

  if (error) throw new Error(`Could not load categories: ${error.message}`)
  return (data ?? []) as Pick<Category, 'id' | 'name' | 'parent_id'>[]
}

async function loadTransactionsForSummary(
  userId: string,
  range: ReturnType<typeof normalizeDateRange>
) {
  const transactions: Pick<Transaction, 'type' | 'amount' | 'category_id'>[] = []

  for (let from = 0; from < MAX_SUMMARY_ROWS; from += SUMMARY_PAGE_SIZE) {
    const { data, error } = await getAdminClient()
      .from('transactions')
      .select('type,amount,category_id')
      .eq('user_id', userId)
      .gte('occurred_at', range.startIso)
      .lt('occurred_at', range.endExclusiveIso)
      .order('id', { ascending: true })
      .range(from, from + SUMMARY_PAGE_SIZE - 1)

    if (error) throw new Error(`Could not load transactions: ${error.message}`)

    const page = (data ?? []) as Pick<
      Transaction,
      'type' | 'amount' | 'category_id'
    >[]
    transactions.push(...page)

    if (page.length < SUMMARY_PAGE_SIZE) return transactions
  }

  throw new Error(
    `The summary exceeds the safety limit of ${MAX_SUMMARY_ROWS} transactions.`
  )
}

export async function getFinancialSummary(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<FinancialSummary> {
  const range = normalizeDateRange(startDate, endDate)

  const [transactions, categories] = await Promise.all([
    loadTransactionsForSummary(userId, range),
    loadCategories(userId),
  ])
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const categoryParent = new Map(
    categories.map((category) => [category.id, category.parent_id])
  )

  let income = 0
  let expenses = 0
  let transfers = 0
  let adjustments = 0
  const expensesByCategory = new Map<string, number>()
  const incomeByCategory = new Map<string, number>()

  for (const transaction of transactions) {
    const amount = Number(transaction.amount)
    if (transaction.type === 'income') {
      income += amount
      const key = categoryGroupKey(
        transaction.category_id,
        categoryName,
        categoryParent
      )
      incomeByCategory.set(key, (incomeByCategory.get(key) ?? 0) + amount)
    } else if (transaction.type === 'expense') {
      expenses += amount
      const key = categoryGroupKey(
        transaction.category_id,
        categoryName,
        categoryParent
      )
      expensesByCategory.set(key, (expensesByCategory.get(key) ?? 0) + amount)
    } else if (transaction.type === 'transfer') {
      transfers += amount
    } else if (transaction.type === 'adjustment') {
      adjustments += amount
    }
  }

  return {
    period: { start_date: range.startDate, end_date: range.endDate },
    currency: 'COP',
    totals: {
      income: roundMoney(income),
      expenses: roundMoney(expenses),
      net_cash_flow: roundMoney(income - expenses + adjustments),
      transfers: roundMoney(transfers),
      adjustments: roundMoney(adjustments),
    },
    transaction_count: transactions.length,
    expenses_by_category: toBreakdown(expensesByCategory, expenses),
    income_by_category: toBreakdown(incomeByCategory, income),
  }
}

export type TransactionSearch = {
  start_date?: string
  end_date?: string
  type?: TransactionType
  source?: TransactionSource
  account_id?: string
  category_id?: string
  query?: string
  minimum_amount?: number
  maximum_amount?: number
  limit?: number
}

export async function searchTransactions(userId: string, input: TransactionSearch) {
  const range = normalizeDateRange(input.start_date, input.end_date)
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_RESULT_LIMIT, 1), MAX_RESULT_LIMIT)

  if (
    input.minimum_amount !== undefined &&
    input.maximum_amount !== undefined &&
    input.minimum_amount > input.maximum_amount
  ) {
    throw new Error('minimum_amount must be less than or equal to maximum_amount.')
  }

  let query = getAdminClient()
    .from('transactions')
    .select(
      'id,type,amount,occurred_at,account_id,to_account_id,category_id,note,source'
    )
    .eq('user_id', userId)
    .gte('occurred_at', range.startIso)
    .lt('occurred_at', range.endExclusiveIso)
    .order('occurred_at', { ascending: false })
    .limit(limit + 1)

  if (input.type) query = query.eq('type', input.type)
  if (input.source) query = query.eq('source', input.source)
  if (input.account_id) {
    query = query.or(
      `account_id.eq.${input.account_id},to_account_id.eq.${input.account_id}`
    )
  }
  if (input.category_id) query = query.eq('category_id', input.category_id)
  if (input.minimum_amount !== undefined) {
    query = query.gte('amount', input.minimum_amount)
  }
  if (input.maximum_amount !== undefined) {
    query = query.lte('amount', input.maximum_amount)
  }
  if (input.query?.trim()) query = query.ilike('note', `%${input.query.trim()}%`)

  const [transactionsResult, accountsResult, categories] = await Promise.all([
    query,
    getAdminClient()
      .from('accounts')
      .select('id,name')
      .eq('user_id', userId),
    loadCategories(userId),
  ])

  if (transactionsResult.error) {
    throw new Error(`Could not search transactions: ${transactionsResult.error.message}`)
  }
  if (accountsResult.error) {
    throw new Error(`Could not load accounts: ${accountsResult.error.message}`)
  }

  const matchingTransactions = (transactionsResult.data ?? []) as Pick<
    Transaction,
    | 'id'
    | 'type'
    | 'amount'
    | 'occurred_at'
    | 'account_id'
    | 'to_account_id'
    | 'category_id'
    | 'note'
    | 'source'
  >[]
  const hasMore = matchingTransactions.length > limit
  const transactions = matchingTransactions.slice(0, limit)
  const accountName = new Map(
    ((accountsResult.data ?? []) as Pick<Account, 'id' | 'name'>[]).map((account) => [
      account.id,
      account.name,
    ])
  )
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const categoryParent = new Map(
    categories.map((category) => [category.id, category.parent_id])
  )

  return {
    period: { start_date: range.startDate, end_date: range.endDate },
    returned_count: transactions.length,
    limit,
    has_more: hasMore,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: roundMoney(Number(transaction.amount)),
      currency: 'COP' as const,
      occurred_at: transaction.occurred_at,
      account: accountName.get(transaction.account_id) ?? 'Cuenta desconocida',
      destination_account: transaction.to_account_id
        ? accountName.get(transaction.to_account_id) ?? 'Cuenta desconocida'
        : null,
      category: transaction.category_id
        ? categoryLabel(
            transaction.category_id,
            categoryName,
            categoryParent,
            'Sin categoría'
          )
        : null,
      note: transaction.note,
      source: transaction.source,
    })),
  }
}

export async function listAccounts(userId: string, includeArchived = false) {
  const [balancesResult, accountsResult] = await Promise.all([
    getAdminClient()
      .from('account_balances')
      .select('id,name,type,currency,credit_limit,balance')
      .eq('user_id', userId),
    getAdminClient()
      .from('accounts')
      .select('id,archived')
      .eq('user_id', userId),
  ])

  if (balancesResult.error) {
    throw new Error(`Could not load balances: ${balancesResult.error.message}`)
  }
  if (accountsResult.error) {
    throw new Error(`Could not load account status: ${accountsResult.error.message}`)
  }

  const archivedById = new Map(
    ((accountsResult.data ?? []) as Pick<Account, 'id' | 'archived'>[]).map((account) => [
      account.id,
      account.archived,
    ])
  )

  return ((balancesResult.data ?? []) as Pick<
    AccountBalance,
    'id' | 'name' | 'type' | 'currency' | 'credit_limit' | 'balance'
  >[])
    .filter((account) => includeArchived || !archivedById.get(account.id))
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: roundMoney(Number(account.balance)),
      credit_limit:
        account.credit_limit === null ? null : roundMoney(Number(account.credit_limit)),
      archived: archivedById.get(account.id) ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / Math.abs(previous)) * 10_000) / 100
}

export async function comparePeriods(
  userId: string,
  first: { start_date: string; end_date: string },
  second: { start_date: string; end_date: string }
) {
  const [firstSummary, secondSummary] = await Promise.all([
    getFinancialSummary(userId, first.start_date, first.end_date),
    getFinancialSummary(userId, second.start_date, second.end_date),
  ])

  const fields = ['income', 'expenses', 'net_cash_flow'] as const
  const changes = Object.fromEntries(
    fields.map((field) => {
      const firstValue = firstSummary.totals[field]
      const secondValue = secondSummary.totals[field]
      return [
        field,
        {
          absolute: roundMoney(secondValue - firstValue),
          percentage: percentageChange(secondValue, firstValue),
        },
      ]
    })
  )

  return {
    first_period: firstSummary,
    second_period: secondSummary,
    change_from_first_to_second: changes,
  }
}

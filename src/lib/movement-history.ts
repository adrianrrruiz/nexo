import { formatDateInputValue } from '@/lib/format'
import type { Transaction } from '@/lib/supabase/types'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type MovementFilters = {
  accountId: string
  categoryIds: string[] | null
  uncategorized: boolean
  reconciliationBoundary: string | null
  showReconciled: boolean
}

export type MovementMonth = {
  month: string
  transactions: Transaction[]
  hasMore: boolean
}

const PAGE_SIZE = 500

function monthStart(month: string) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1, 1, 5)).toISOString()
}

function nextMonthStart(month: string) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 1, 5)).toISOString()
}

function applyFilters<T extends {
  eq: (column: string, value: string) => T
  or: (filters: string) => T
  is: (column: string, value: null) => T
  in: (column: string, values: string[]) => T
  lt: (column: string, value: string) => T
  gte: (column: string, value: string) => T
}>(query: T, userId: string, filters: MovementFilters): T {
  let result = query.eq('user_id', userId)
  if (filters.accountId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.accountId)) {
      throw new Error('Cuenta inválida.')
    }
    result = result.or(
      `account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`
    )
  }
  if (filters.reconciliationBoundary) {
    result = filters.showReconciled
      ? result.lt('occurred_at', filters.reconciliationBoundary)
      : result.gte('occurred_at', filters.reconciliationBoundary)
  }
  if (filters.uncategorized) result = result.is('category_id', null)
  else if (filters.categoryIds) result = result.in('category_id', filters.categoryIds)
  return result
}

/** Trae un mes entero; la consulta interna se pagina para superar el límite de filas de PostgREST. */
export async function loadMovementMonth(
  supabase: SupabaseClient,
  userId: string,
  filters: MovementFilters,
  beforeMonth?: string
): Promise<MovementMonth | null> {
  let latestQuery = applyFilters(
    supabase.from('transactions').select('occurred_at'),
    userId,
    filters
  ).order('occurred_at', { ascending: false }).limit(1)
  if (beforeMonth) latestQuery = latestQuery.lt('occurred_at', monthStart(beforeMonth))
  const { data: latest, error: latestError } = await latestQuery.maybeSingle()
  if (latestError) throw new Error(`No se pudieron cargar los movimientos: ${latestError.message}`)
  if (!latest) return null

  const month = formatDateInputValue(latest.occurred_at).slice(0, 7)
  const start = monthStart(month)
  const end = nextMonthStart(month)
  const transactions: Transaction[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyFilters(
      supabase.from('transactions').select('*'),
      userId,
      filters
    )
      .gte('occurred_at', start)
      .lt('occurred_at', end)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`No se pudieron cargar los movimientos: ${error.message}`)
    const batch = (data ?? []) as Transaction[]
    transactions.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  const { data: older, error: olderError } = await applyFilters(
    supabase.from('transactions').select('id'),
    userId,
    filters
  ).lt('occurred_at', start).limit(1)
  if (olderError) throw new Error(`No se pudieron consultar meses anteriores: ${olderError.message}`)

  return { month, transactions, hasMore: Boolean(older?.length) }
}

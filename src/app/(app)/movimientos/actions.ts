'use server'

import { createClient } from '@/lib/supabase/server'
import { categoryIdsInGroup, UNCATEGORIZED_KEY } from '@/lib/categories'
import { loadMovementMonth } from '@/lib/movement-history'
import type { Category } from '@/lib/supabase/types'

function dayAfterInBogota(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1, 5)).toISOString()
}

export async function loadOlderMovementMonth({
  accountId,
  categoryId,
  showReconciled,
  beforeMonth,
}: {
  accountId: string
  categoryId: string
  showReconciled: boolean
  beforeMonth: string
}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(beforeMonth)) {
    throw new Error('Mes inválido.')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesión expirada.')

  const [accountRes, categoriesRes] = await Promise.all([
    accountId
      ? supabase.from('accounts').select('reconciled_through').eq('id', accountId).eq('user_id', user.id).eq('archived', false).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    categoryId && categoryId !== UNCATEGORIZED_KEY
      ? supabase.from('categories').select('id,parent_id').eq('user_id', user.id).eq('is_suggested', false)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (accountRes.error || categoriesRes.error) {
    throw new Error('No se pudieron cargar los filtros de movimientos.')
  }

  const categories = (categoriesRes.data ?? []) as Pick<Category, 'id' | 'parent_id'>[]
  const ids = categoryId && categoryId !== UNCATEGORIZED_KEY
    ? categoryIdsInGroup(categoryId, categories)
    : null
  const reconciledThrough = accountRes.data?.reconciled_through ?? null

  return loadMovementMonth(supabase, user.id, {
    accountId,
    categoryIds: ids ? (ids.length ? ids : [categoryId]) : null,
    uncategorized: categoryId === UNCATEGORIZED_KEY,
    reconciliationBoundary: reconciledThrough ? dayAfterInBogota(reconciledThrough) : null,
    showReconciled: Boolean(reconciledThrough && showReconciled),
  }, beforeMonth)
}

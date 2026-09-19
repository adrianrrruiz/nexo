import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatLongDate } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import MovementAccountFilter from '@/components/MovementAccountFilter'
import MovementHistory from '@/components/MovementHistory'
import { createAccountImageUrlMap } from '@/lib/account-images'
import {
  categoryIdsInGroup,
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_LABEL,
} from '@/lib/categories'
import { loadMovementMonth } from '@/lib/movement-history'
import type { Account, Category } from '@/lib/supabase/types'

/** Construye la URL de movimientos filtrada por categoría, conservando la cuenta. */
function categoriaHref(categoriaId: string, accountId: string, showReconciled: boolean) {
  const params = new URLSearchParams()
  if (accountId) params.set('cuenta', accountId)
  if (categoriaId) params.set('categoria', categoriaId)
  if (showReconciled) params.set('anteriores', '1')
  return `/movimientos?${params.toString()}`
}

function dayAfterInBogota(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1, 5)).toISOString()
}

export const dynamic = 'force-dynamic'

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; categoria?: string; anteriores?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { cuenta, categoria, anteriores } = await searchParams
  const selectedAccountId = cuenta ?? ''
  const selectedCategoryId = categoria ?? ''

  // Cuentas y categorías primero: el filtro por categoría necesita resolver
  // los ids del grupo (padre + subcategorías) antes de consultar movimientos.
  const [accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,type,image_path,reconciled_through,reconciliation_note')
      .eq('archived', false),
    supabase
      .from('categories')
      .select('id,name,kind,parent_id')
      .eq('user_id', user.id)
      .eq('is_suggested', false),
  ])

  const setupError = accountsRes.error ?? categoriesRes.error
  if (setupError) {
    throw new Error(`No se pudieron cargar los filtros de movimientos: ${setupError.message}`)
  }

  const accounts = (accountsRes.data ?? []) as Pick<
    Account,
    'id' | 'name' | 'type' | 'image_path' | 'reconciled_through' | 'reconciliation_note'
  >[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId)
  const reconciledThrough = selectedAccount?.reconciled_through ?? null
  const showReconciled = Boolean(reconciledThrough && anteriores === '1')
  const reconciliationBoundary = reconciledThrough
    ? dayAfterInBogota(reconciledThrough)
    : null

  const categoryIds = selectedCategoryId && selectedCategoryId !== UNCATEGORIZED_KEY
    ? categoryIdsInGroup(selectedCategoryId, categories)
    : null
  const firstMonth = await loadMovementMonth(supabase, user.id, {
    accountId: selectedAccountId,
    categoryIds: categoryIds ? (categoryIds.length ? categoryIds : [selectedCategoryId]) : null,
    uncategorized: selectedCategoryId === UNCATEGORIZED_KEY,
    reconciliationBoundary,
    showReconciled,
  })

  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const selectedAccountName = selectedAccountId
    ? accountName.get(selectedAccountId) ?? 'esta cuenta'
    : null
  const accountImageUrl = await createAccountImageUrlMap(accounts.map((a) => a.image_path))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const selectedCategoryName = selectedCategoryId
    ? selectedCategoryId === UNCATEGORIZED_KEY
      ? UNCATEGORIZED_LABEL
      : categoryName.get(selectedCategoryId) ?? 'esta categoría'
    : null

  return (
    <>
      <header className="mb-6 lg:mb-8">
        <h1 className="text-xl font-semibold lg:text-2xl">Movimientos</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          {selectedCategoryName
            ? `Historial en ${selectedCategoryName}`
            : selectedAccountName
              ? `Historial de ${selectedAccountName}`
              : 'Todos tus movimientos'}
        </p>
      </header>

      <div className="mb-5 space-y-3">
        <MovementAccountFilter
          accounts={accounts}
          selectedAccountId={selectedAccountId}
        />
        {reconciledThrough && (
          <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-4 text-sm">
            <p className="font-medium text-brand">
              {showReconciled ? 'Movimientos conciliados' : 'Movimientos por revisar'}
            </p>
            <p className="mt-1 text-xs text-neutral-300">
              {selectedAccount?.name} · conciliada hasta el {formatLongDate(reconciledThrough)}
            </p>
            {selectedAccount?.reconciliation_note && (
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-300">
                {selectedAccount.reconciliation_note}
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-500">
              {showReconciled
                ? 'Estás viendo movimientos anteriores o del día conciliado.'
                : 'Se muestran solo movimientos posteriores a la fecha conciliada.'}
            </p>
            <Link
              href={categoriaHref(selectedCategoryId, selectedAccountId, !showReconciled)}
              className="mt-2 inline-block text-xs font-semibold text-brand underline underline-offset-2"
            >
              {showReconciled ? 'Volver a pendientes' : 'Ver movimientos conciliados'}
            </Link>
          </div>
        )}
        {selectedCategoryName && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Categoría:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 py-1 pl-3 pr-1.5 font-medium text-brand">
              {selectedCategoryName}
              <Link
                href={selectedAccountId
                  ? `/movimientos?cuenta=${selectedAccountId}${showReconciled ? '&anteriores=1' : ''}`
                  : '/movimientos'}
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

      {!firstMonth ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">
            {selectedAccountName
              ? showReconciled
                ? 'Sin movimientos anteriores a la fecha conciliada.'
                : reconciledThrough
                  ? 'No hay movimientos pendientes después de la fecha conciliada.'
                  : 'Sin movimientos para esta cuenta.'
              : 'Sin movimientos todavía.'}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {showReconciled
              ? 'Puedes volver a los movimientos pendientes desde el filtro de arriba.'
              : 'Toca el botón + para registrar un movimiento nuevo.'}
          </p>
        </div>
      ) : (
        <MovementHistory
          key={`${selectedAccountId}:${selectedCategoryId}:${showReconciled}`}
          initialMonth={firstMonth}
          accounts={accounts}
          categories={categories}
          imageUrls={Object.fromEntries(accountImageUrl)}
          accountId={selectedAccountId}
          categoryId={selectedCategoryId}
          showReconciled={showReconciled}
        />
      )}

      <QuickEntry accounts={accounts} categories={categories} />
    </>
  )
}

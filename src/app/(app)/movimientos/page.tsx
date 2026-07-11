import { createClient } from '@/lib/supabase/server'
import { formatDay } from '@/lib/format'
import QuickEntry from '@/components/QuickEntry'
import TransactionRow, { TX_META } from '@/components/TransactionRow'
import type { Account, Category, Transaction } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function MovimientosPage() {
  const supabase = await createClient()

  const [accountsRes, categoriesRes, txRes] = await Promise.all([
    supabase.from('accounts').select('id,name,type').eq('archived', false),
    supabase.from('categories').select('id,name,kind,parent_id'),
    supabase
      .from('transactions')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(150),
  ])

  const accounts = (accountsRes.data ?? []) as Pick<Account, 'id' | 'name' | 'type'>[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]
  const txs = (txRes.data ?? []) as Transaction[]

  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  // agrupa por día (etiqueta corta es-CO)
  const byDay = new Map<string, Transaction[]>()
  for (const t of txs) {
    const day = formatDay(t.occurred_at)
    const list = byDay.get(day)
    if (list) list.push(t)
    else byDay.set(day, [t])
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Tus últimos {txs.length} registros
        </p>
      </header>

      {txs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">Sin movimientos todavía.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Toca el botón <span className="font-semibold text-brand">+</span> para
            registrar el primero.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {day}
              </h2>
              <ul className="divide-y divide-white/[0.05]">
                {list.map((t) => {
                  const meta = TX_META[t.type]
                  const label =
                    t.type === 'transfer'
                      ? `${accountName.get(t.account_id) ?? ''} → ${
                          t.to_account_id
                            ? accountName.get(t.to_account_id) ?? ''
                            : ''
                        }`
                      : t.category_id
                        ? categoryName.get(t.category_id) ?? meta.label
                        : meta.label
                  return (
                    <TransactionRow
                      key={t.id}
                      type={t.type}
                      label={label}
                      sublabel={`${accountName.get(t.account_id) ?? ''}${
                        t.note ? ` · ${t.note}` : ''
                      }`}
                      amount={Number(t.amount)}
                    />
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <QuickEntry accounts={accounts} categories={categories} />
    </>
  )
}

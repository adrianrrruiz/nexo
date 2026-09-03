import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/categories'
import { formatCOP, formatLongDate } from '@/lib/format'
import {
  FREQUENCY_LABEL,
  describeDueDate,
  isDue,
  monthlyEquivalent,
  todayInBogota,
} from '@/lib/subscriptions'
import SubscriptionDueList, {
  type DueSubscription,
} from '@/components/SubscriptionDueList'
import {
  EditSubscriptionButton,
  NewSubscriptionButton,
} from '@/components/SubscriptionManager'
import type { Account, Category, Subscription } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function SuscripcionesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [subscriptionsRes, accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('next_charge_on'),
    supabase.from('accounts').select('id,name').eq('archived', false).order('name'),
    supabase
      .from('categories')
      .select('id,name,kind,parent_id')
      .eq('user_id', user.id)
      .eq('is_suggested', false),
  ])

  const queryError = subscriptionsRes.error ?? accountsRes.error ?? categoriesRes.error
  if (queryError) {
    throw new Error(`No se pudieron cargar las suscripciones: ${queryError.message}`)
  }

  const subscriptions = (subscriptionsRes.data ?? []) as Subscription[]
  const accounts = (accountsRes.data ?? []) as Pick<Account, 'id' | 'name'>[]
  const categories = (categoriesRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'parent_id'
  >[]

  const accountName = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const categoryParent = new Map(
    categories.map((category) => [category.id, category.parent_id])
  )
  const today = todayInBogota()

  const active = subscriptions.filter((subscription) => subscription.active)
  const paused = subscriptions.filter((subscription) => !subscription.active)
  const due = active.filter((subscription) => isDue(subscription.next_charge_on, today))
  const upcoming = active.filter(
    (subscription) => !isDue(subscription.next_charge_on, today)
  )

  const monthlyTotal = active.reduce(
    (sum, subscription) =>
      sum + monthlyEquivalent(Number(subscription.amount), subscription.frequency),
    0
  )

  const describe = (subscription: Subscription) =>
    subscription.category_id
      ? categoryLabel(subscription.category_id, categoryName, categoryParent, '')
      : null

  const dueItems: DueSubscription[] = due.map((subscription) => ({
    id: subscription.id,
    name: subscription.name,
    amount: Number(subscription.amount),
    accountName: accountName.get(subscription.account_id) ?? 'Cuenta archivada',
    categoryLabel: describe(subscription),
    dueLabel: describeDueDate(subscription.next_charge_on, today),
    overdue: subscription.next_charge_on < today,
  }))

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4 lg:mb-8">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">Suscripciones</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {active.length === 0 ? (
              'Cobros recurrentes con recordatorio.'
            ) : (
              <>
                Equivalen a{' '}
                <span className="font-semibold tabular-nums text-brand">
                  {formatCOP(monthlyTotal)}
                </span>{' '}
                al mes
              </>
            )}
          </p>
        </div>
        <NewSubscriptionButton accounts={accounts} categories={categories} />
      </header>

      {subscriptions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">Aún no tienes suscripciones.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Crea una con el botón{' '}
            <span className="font-semibold text-brand">Nueva</span> y te avisaremos
            cada vez que llegue la fecha de cobro.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dueItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-neutral-200">
                Por registrar
              </h2>
              <SubscriptionDueList items={dueItems} />
            </section>
          )}

          <SubscriptionSection
            title="Próximas"
            subscriptions={upcoming}
            accountName={accountName}
            describe={describe}
            accounts={accounts}
            categories={categories}
          />

          <SubscriptionSection
            title="Pausadas"
            subscriptions={paused}
            accountName={accountName}
            describe={describe}
            accounts={accounts}
            categories={categories}
            muted
          />
        </div>
      )}
    </>
  )
}

function SubscriptionSection({
  title,
  subscriptions,
  accountName,
  describe,
  accounts,
  categories,
  muted = false,
}: {
  title: string
  subscriptions: Subscription[]
  accountName: Map<string, string>
  describe: (subscription: Subscription) => string | null
  accounts: Pick<Account, 'id' | 'name'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
  muted?: boolean
}) {
  if (subscriptions.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">{title}</h2>
      <ul className="divide-y divide-white/[0.05] rounded-3xl border border-white/[0.06] bg-white/[0.02] px-4 lg:px-5">
        {subscriptions.map((subscription) => {
          const category = describe(subscription)
          return (
            <li
              key={subscription.id}
              className={`flex items-center gap-3 py-3.5 ${muted ? 'opacity-60' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {subscription.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {FREQUENCY_LABEL[subscription.frequency]} ·{' '}
                  {accountName.get(subscription.account_id) ?? 'Cuenta archivada'}
                  {category ? ` · ${category}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-neutral-100">
                  {formatCOP(Number(subscription.amount))}
                </p>
                <p className="mt-0.5 text-[11px] capitalize text-neutral-500">
                  {muted ? 'Pausada' : formatLongDate(subscription.next_charge_on)}
                </p>
              </div>
              <EditSubscriptionButton
                subscription={subscription}
                accounts={accounts}
                categories={categories}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

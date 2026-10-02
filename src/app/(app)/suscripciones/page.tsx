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
  NewServiceButton,
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
    editControl: <EditSubscriptionButton subscription={subscription} accounts={accounts} categories={categories} />,
    kind: subscription.kind,
    accountId: subscription.account_id,
    nextChargeOn: subscription.next_charge_on,
    name: subscription.name,
    amount: Number(subscription.amount),
    accountName: subscription.account_id ? accountName.get(subscription.account_id) ?? 'Cuenta archivada' : 'Cuenta por elegir',
    categoryLabel: describe(subscription),
    dueLabel: subscription.kind === 'service' && subscription.next_charge_until ? `${formatLongDate(subscription.next_charge_on)} – ${formatLongDate(subscription.next_charge_until)}` : describeDueDate(subscription.next_charge_on, today),
    overdue: (subscription.next_charge_until ?? subscription.next_charge_on) < today,
  }))

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 lg:mb-8">
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
            <span className="font-semibold text-brand">Crear suscripción</span> y te avisaremos
            cada vez que llegue la fecha de cobro.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dueItems.some(item => item.kind === 'subscription') && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-neutral-200">
                Por registrar
              </h2>
              <SubscriptionDueList items={dueItems.filter(item => item.kind === 'subscription')} accounts={accounts} />
            </section>
          )}

          <SubscriptionSection
            title="Suscripciones próximas"
            subscriptions={upcoming.filter(item => item.kind === 'subscription')}
            accountName={accountName}
            describe={describe}
            accounts={accounts}
            categories={categories}
          />

          <SubscriptionSection
            title="Pausadas"
            subscriptions={paused.filter(item => item.kind === 'subscription')}
            accountName={accountName}
            describe={describe}
            accounts={accounts}
            categories={categories}
            muted
          />
        </div>
      )}
      <section className="mt-8 border-t border-white/[0.06] pt-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold">Servicios</h2><p className="mt-1 text-sm text-neutral-500">Agua, energía, internet y otros cobros que pueden variar.</p></div>
          <NewServiceButton accounts={accounts} categories={categories} />
        </div>
        {dueItems.some(item => item.kind === 'service') && <div className="mb-6"><h3 className="mb-3 text-sm font-semibold text-neutral-200">Recordatorios de servicios</h3><SubscriptionDueList items={dueItems.filter(item => item.kind === 'service')} accounts={accounts} /></div>}
        {!subscriptions.some(item => item.kind === 'service') && <p className="rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-relaxed text-neutral-400">Agrega un costo aproximado y un rango de pago. Puedes elegir la cuenta después, al registrar el gasto.</p>}
        <div className="space-y-6">
          <SubscriptionSection title="Servicios próximos" subscriptions={upcoming.filter(item => item.kind === 'service')} accountName={accountName} describe={describe} accounts={accounts} categories={categories} />
          <SubscriptionSection title="Servicios pausados" subscriptions={paused.filter(item => item.kind === 'service')} accountName={accountName} describe={describe} accounts={accounts} categories={categories} muted />
        </div>
      </section>
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
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 ${muted ? 'opacity-60' : ''}`}
            >
              <div className="col-span-2 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {subscription.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {FREQUENCY_LABEL[subscription.frequency]} ·{' '}
                  {subscription.account_id ? accountName.get(subscription.account_id) ?? 'Cuenta archivada' : 'Cuenta por elegir'}
                  {category ? ` · ${category}` : ''}
                </p>
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold tabular-nums text-neutral-100">
                  {subscription.kind === 'service' ? '≈ ' : ''}{formatCOP(Number(subscription.amount))}
                </p>
                <p className="mt-0.5 text-[11px] capitalize text-neutral-500">
                  {muted ? 'Pausado' : `${formatLongDate(subscription.next_charge_on)}${subscription.next_charge_until ? ` – ${formatLongDate(subscription.next_charge_until)}` : ''}`}
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

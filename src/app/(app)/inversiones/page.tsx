import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInvestmentData } from '@/lib/investments/data'
import InvestmentWorkspace from '@/components/investments/InvestmentWorkspace'

export const metadata: Metadata = { title: 'Inversiones | Nexo' }

export default async function InvestmentsPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')

  const [portfolio, preference, accountList] = await Promise.all([
    getInvestmentData(client, user.id),
    client.from('investment_preferences').select('currency').eq('user_id', user.id).maybeSingle(),
    client.from('accounts').select('id,name').eq('user_id', user.id).eq('archived', false).neq('type', 'credit').order('name'),
  ])

  if (portfolio.error || preference.error || accountList.error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Inversiones</h1>
        <p role="status" className="rounded-2xl border border-white/10 bg-surface p-5 text-sm text-neutral-300">
          Por ahora no se pudieron cargar tus inversiones. Vuelve a intentarlo en unos minutos.
        </p>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">Volver a Inicio</Link>
      </section>
    )
  }

  return (
    <InvestmentWorkspace
      positions={portfolio.positions}
      market={portfolio.market}
      currency={preference.data?.currency ?? 'COP'}
      accounts={accountList.data}
    />
  )
}

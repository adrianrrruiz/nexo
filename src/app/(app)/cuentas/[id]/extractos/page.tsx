import Link from 'next/link'
import { notFound } from 'next/navigation'
import AccountStatementManager from '@/components/AccountStatementManager'
import { BANK_LABEL } from '@/lib/banks'
import { ACCOUNT_STATEMENTS_BUCKET } from '@/lib/statement-config'
import { createClient } from '@/lib/supabase/server'
import type { Account, AccountStatement } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function AccountStatementsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('id,name,bank,type')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (accountError || !accountData) notFound()
  const account = accountData as Pick<Account, 'id' | 'name' | 'bank' | 'type'>

  const { data: statementData, error: statementsError } = await supabase
    .from('account_statements')
    .select('id,period,original_filename,storage_path,size_bytes,created_at')
    .eq('account_id', account.id)
    .order('period', { ascending: false })
    .order('created_at', { ascending: false })

  if (statementsError) {
    throw new Error(`No se pudieron cargar los extractos: ${statementsError.message}`)
  }

  const statements = (statementData ?? []) as Pick<
    AccountStatement,
    | 'id'
    | 'period'
    | 'original_filename'
    | 'storage_path'
    | 'size_bytes'
    | 'created_at'
  >[]
  const signed = statements.length
    ? await supabase.storage
        .from(ACCOUNT_STATEMENTS_BUCKET)
        .createSignedUrls(
          statements.map((statement) => statement.storage_path),
          15 * 60
        )
    : { data: [], error: null }
  const signedUrlByPath = new Map(
    (signed.data ?? []).map((item) => [item.path, item.signedUrl])
  )

  return (
    <>
      <header className="mb-6 lg:mb-8">
        <Link
          href="/cuentas"
          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-brand"
        >
          <span aria-hidden>←</span> Volver a cuentas
        </Link>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {BANK_LABEL[account.bank]}
          </p>
          <h1 className="mt-1 text-xl font-semibold lg:text-2xl">
            Extractos de {account.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Conserva y consulta el historial documental de esta cuenta.
          </p>
        </div>
      </header>

      <AccountStatementManager
        accountId={account.id}
        statements={statements.map((statement) => ({
          ...statement,
          signedUrl: signedUrlByPath.get(statement.storage_path) ?? null,
        }))}
      />
    </>
  )
}

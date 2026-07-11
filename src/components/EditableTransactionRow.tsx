'use client'

import TransactionEditor from '@/components/TransactionEditor'
import TransactionRow from '@/components/TransactionRow'
import type { Account, Category, Transaction } from '@/lib/supabase/types'

export default function EditableTransactionRow({
  transaction,
  accounts,
  categories,
  label,
  sublabel,
  accountName,
  accountType,
  accountImageUrl,
}: {
  transaction: Transaction
  accounts: Pick<Account, 'id' | 'name' | 'type' | 'image_path'>[]
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'parent_id'>[]
  label: string
  sublabel: string
  accountName?: string
  accountType?: Account['type']
  accountImageUrl?: string | null
}) {
  return (
    <TransactionEditor
      transaction={transaction}
      accounts={accounts}
      categories={categories}
      renderTrigger={(open) => (
        <TransactionRow
          type={transaction.type}
          label={label}
          sublabel={sublabel}
          amount={Number(transaction.amount)}
          accountName={accountName}
          accountType={accountType}
          accountImageUrl={accountImageUrl}
          onClick={open}
        />
      )}
    />
  )
}

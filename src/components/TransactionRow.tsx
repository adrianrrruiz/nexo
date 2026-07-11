'use client'

import { formatCOP } from '@/lib/format'
import { getTransactionMeta } from '@/lib/transaction-meta'
import AccountAvatar from '@/components/AccountAvatar'
import type { AccountType, TransactionType } from '@/lib/supabase/types'

export default function TransactionRow({
  type,
  label,
  sublabel,
  amount,
  accountName,
  accountType,
  accountImageUrl,
  onClick,
}: {
  type: TransactionType
  label: string
  sublabel: string
  amount: number
  accountName?: string
  accountType?: AccountType
  accountImageUrl?: string | null
  onClick?: () => void
}) {
  const meta = getTransactionMeta(type)
  return (
    <li
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`flex items-center gap-3 py-3 ${
        onClick ? 'cursor-pointer rounded-2xl outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04]' : ''
      }`}
    >
      {accountImageUrl && accountName && accountType ? (
        <AccountAvatar
          name={accountName}
          type={accountType}
          imageUrl={accountImageUrl}
          className="h-10 w-10 rounded-full"
        />
      ) : (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.chip}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4.5 w-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {meta.icon}
          </svg>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-100">{label}</p>
        <p className="truncate text-xs text-neutral-500">{sublabel}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${meta.color}`}>
        {meta.sign}
        {formatCOP(amount)}
      </span>
    </li>
  )
}

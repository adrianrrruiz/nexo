import { formatCOP } from '@/lib/format'
import type { TransactionType } from '@/lib/supabase/types'

export const TX_META: Record<
  TransactionType,
  { sign: string; color: string; chip: string; label: string; icon: React.ReactNode }
> = {
  income: {
    sign: '+',
    color: 'text-brand',
    chip: 'bg-brand/10 text-brand',
    label: 'Ingreso',
    icon: <path d="M17 7 7 17M7 9v8h8" />,
  },
  expense: {
    sign: '−',
    color: 'text-red-400',
    chip: 'bg-red-500/10 text-red-400',
    label: 'Gasto',
    icon: <path d="M7 17 17 7M9 7h8v8" />,
  },
  transfer: {
    sign: '',
    color: 'text-sky-400',
    chip: 'bg-sky-500/10 text-sky-400',
    label: 'Transferencia',
    icon: <path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3" />,
  },
  adjustment: {
    sign: '',
    color: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-400',
    label: 'Ajuste',
    icon: <path d="M6 4v7m0 4v5m6-16v3m0 4v9m6-16v11m0 4v1M4 11h4m4-4h4m-4 11h4" />,
  },
}

export default function TransactionRow({
  type,
  label,
  sublabel,
  amount,
}: {
  type: TransactionType
  label: string
  sublabel: string
  amount: number
}) {
  const meta = TX_META[type]
  return (
    <li className="flex items-center gap-3 py-3">
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

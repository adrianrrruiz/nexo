import type { AccountType } from '@/lib/supabase/types'

const TYPE_INITIAL: Record<AccountType, string> = {
  debit: 'D',
  savings: 'A',
  credit: 'C',
  cash: 'E',
}

export default function AccountAvatar({
  name,
  type,
  imageUrl,
  className = 'h-11 w-11 rounded-2xl',
}: {
  name: string
  type: AccountType
  imageUrl?: string | null
  className?: string
}) {
  if (imageUrl) {
    return (
      <span
        aria-label={name}
        className={`block shrink-0 bg-cover bg-center ${className}`}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    )
  }

  return (
    <span
      aria-label={name}
      className={`flex shrink-0 items-center justify-center bg-brand/10 text-sm font-semibold text-brand ${className}`}
    >
      {TYPE_INITIAL[type]}
    </span>
  )
}

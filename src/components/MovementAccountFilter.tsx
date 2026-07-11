'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Account } from '@/lib/supabase/types'

export default function MovementAccountFilter({
  accounts,
  selectedAccountId,
}: {
  accounts: Pick<Account, 'id' | 'name'>[]
  selectedAccountId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <label className="relative block">
      <span className="sr-only">Filtrar por cuenta</span>
      <select
        value={selectedAccountId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams)
          if (event.target.value) params.set('cuenta', event.target.value)
          else params.delete('cuenta')
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname)
        }}
        className="w-full appearance-none rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 pr-10 text-sm text-neutral-200 outline-none transition-colors focus:border-brand/50"
      >
        <option value="">Todas las cuentas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )
}

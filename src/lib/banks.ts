import type { SupportedBank } from '@/lib/supabase/types'

export const SUPPORTED_BANKS: readonly {
  value: SupportedBank
  label: string
}[] = [
  { value: 'nequi', label: 'Nequi' },
  { value: 'rappi', label: 'Rappi' },
  { value: 'nu', label: 'Nu' },
]

export const BANK_LABEL: Record<SupportedBank, string> = Object.fromEntries(
  SUPPORTED_BANKS.map((bank) => [bank.value, bank.label])
) as Record<SupportedBank, string>

export function isSupportedBank(value: string): value is SupportedBank {
  return SUPPORTED_BANKS.some((bank) => bank.value === value)
}

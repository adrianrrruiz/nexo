import type { AccountType, SupportedBank } from '@/lib/supabase/types'

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

const DEFAULT_IMAGE_BY_BANK: Record<
  SupportedBank,
  { standard: string; credit?: string }
> = {
  nequi: { standard: 'defaults/nequi.jpeg' },
  nu: {
    standard: 'defaults/nu.jpeg',
    credit: 'defaults/nu-credit.png',
  },
  rappi: {
    standard: 'defaults/rappi.jpeg',
    credit: 'defaults/rappi-credit.jpg',
  },
}

export function getDefaultAccountImagePath(
  bank: SupportedBank,
  type: AccountType
) {
  const images = DEFAULT_IMAGE_BY_BANK[bank]
  return type === 'credit' && images.credit ? images.credit : images.standard
}

export function isDefaultAccountImage(path: string | null) {
  return path?.startsWith('defaults/') ?? false
}

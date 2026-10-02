import type { AccountType, SupportedBank } from '@/lib/supabase/types'

type BankOption = {
  value: SupportedBank
  label: string
}

const BANK_OPTIONS: BankOption[] = [
  { value: 'av_villas', label: 'AV Villas' },
  { value: 'banco_agrario', label: 'Banco Agrario' },
  { value: 'banco_caja_social', label: 'Banco Caja Social' },
  { value: 'banco_de_bogota', label: 'Banco de Bogotá' },
  { value: 'banco_de_occidente', label: 'Banco de Occidente' },
  { value: 'banco_popular', label: 'Banco Popular' },
  { value: 'davibank', label: 'DAVIbank (antes Scotiabank Colpatria)' },
  { value: 'daviplata', label: 'DaviPlata' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'finandina', label: 'Finandina' },
  { value: 'gnb_sudameris', label: 'GNB Sudameris' },
  { value: 'itau', label: 'Itaú' },
  { value: 'lulo', label: 'Lulo Bank' },
  { value: 'pibank', label: 'Pibank' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'rappi', label: 'Rappi' },
  { value: 'nu', label: 'Nu' },
  { value: 'bbva', label: 'BBVA' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'falabella', label: 'Falabella' },
]

export const SUPPORTED_BANKS: readonly BankOption[] = BANK_OPTIONS.sort((a, b) =>
  a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
)

export const BANK_LABEL: Record<SupportedBank, string> = Object.fromEntries(
  SUPPORTED_BANKS.map((bank) => [bank.value, bank.label])
) as Record<SupportedBank, string>

export function isSupportedBank(value: string): value is SupportedBank {
  return SUPPORTED_BANKS.some((bank) => bank.value === value)
}

const DEFAULT_IMAGE_BY_BANK: Partial<Record<
  SupportedBank,
  { standard: string | null; credit?: string }
>> = {
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
  if (!images) return null
  return type === 'credit' && images.credit ? images.credit : images.standard
}

export function isDefaultAccountImage(path: string | null) {
  return path?.startsWith('defaults/') ?? false
}

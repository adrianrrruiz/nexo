import { z } from 'zod'
import { ASSET_LABELS, SYMBOL_PATTERN } from '@nexo/shared/investments'
import type { InvestmentAssetType } from '@nexo/shared/types'

export const currencySchema = z.enum(['COP', 'USD'])
const assetTypes = Object.keys(ASSET_LABELS) as [InvestmentAssetType, ...InvestmentAssetType[]]
const amount = z.number().finite().min(0).max(9_999_999_999)

export const positionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  symbol: z.string().trim().toUpperCase().regex(SYMBOL_PATTERN).nullable(),
  asset_type: z.enum(assetTypes),
  quantity: amount,
  average_price: amount.nullable(),
  cost_currency: currencySchema,
  manual_price: amount.nullable(),
  manual_currency: currencySchema,
  account_id: z.string().uuid().nullable(),
})

export const MARKET_RANGES = { '1m': 31, '3m': 93, '6m': 183, '1y': 365, '5y': 1827 } as const
export const rangeSchema = z.enum(['1m', '3m', '6m', '1y', '5y'])
export type MarketRange = keyof typeof MARKET_RANGES

export const positionVersion = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
})
export const MAX_IMPORT_ROWS = 250
export const MAX_IMPORT_BYTES = 512 * 1024

/** Decimal separator is explicit when an export's column separator disambiguates it. */
export function parseInvestmentNumber(raw: string, locale: 'auto' | 'decimal-comma' | 'decimal-dot' = 'auto') {
  const value = raw.trim().replace(/[\s$]/g, '')
  if (!value) return null
  if (/^\d+(?:[.,]\d{1,8})?$/.test(value)) {
    if (locale === 'decimal-comma' && /^\d{1,3}\.\d{3}$/.test(value)) {
      return Number(value.replace('.', ''))
    }
    if (locale === 'decimal-dot' && /^\d{1,3},\d{3}$/.test(value)) {
      return Number(value.replace(',', ''))
    }
    return Number(value.replace(',', '.'))
  }
  if (/^\d{1,3}(\.\d{3})+(,\d{1,8})?$/.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'))
  if (/^\d{1,3}(,\d{3})+(\.\d{1,8})?$/.test(value)) return Number(value.replaceAll(',', ''))
  return NaN
}

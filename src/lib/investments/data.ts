import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import { ASSET_LABELS, SYMBOL_PATTERN, type MarketSnapshot } from '@nexo/shared/investments'
import type { InvestmentAssetType, InvestmentMarket, InvestmentPosition } from '@nexo/shared/types'
import type { createClient } from '@/lib/supabase/server'
import { currencySchema } from './input'

export type InvestmentClient = Awaited<ReturnType<typeof createClient>>

const quoteSchema = z.object({
  price: z.number().finite().positive(),
  currency: currencySchema,
  asOf: z.string().datetime({ offset: true }),
  change: z.number().finite().nullable(),
  assetType: z.enum(Object.keys(ASSET_LABELS) as [InvestmentAssetType, ...InvestmentAssetType[]]).nullable(),
})

export function readMarket(row: InvestmentMarket | null): MarketSnapshot {
  const quotes: MarketSnapshot['quotes'] = {}
  if (row?.quotes && typeof row.quotes === 'object' && !Array.isArray(row.quotes)) {
    for (const [symbol, value] of Object.entries(row.quotes)) {
      const result = quoteSchema.safeParse(value)
      if (SYMBOL_PATTERN.test(symbol) && result.success) quotes[symbol] = result.data
    }
  }
  const rate = row?.usd_cop
  return {
    quotes,
    usdCop: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null,
    rateAt: row?.rate_at ?? null,
    checkedAt: row?.checked_at ?? null,
  }
}

export async function getPositions(client: InvestmentClient, userId: string) {
  const positions: InvestmentPosition[] = []
  const pageSize = 500
  let lastId: string | null = null
  while (true) {
    let query = client.from('investment_positions').select('*').eq('user_id', userId).order('id').limit(pageSize)
    if (lastId !== null) query = query.gt('id', lastId)
    const page: { data: InvestmentPosition[] | null; error: PostgrestError | null } = await query
    if (!page.data) return { positions: [], error: page.error }
    positions.push(...page.data)
    if (page.data.length < pageSize) return { positions, error: null }
    lastId = page.data[page.data.length - 1].id
  }
}

export async function getInvestmentData(client: InvestmentClient, userId: string) {
  const [positions, market] = await Promise.all([
    getPositions(client, userId),
    client.from('investment_market').select('*').eq('user_id', userId).maybeSingle(),
  ])
  return {
    positions: positions.positions,
    market: readMarket(market.data),
    error: positions.error ?? market.error,
  }
}

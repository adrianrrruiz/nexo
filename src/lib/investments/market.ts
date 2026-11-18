import 'server-only'
import YahooFinance from 'yahoo-finance2'
import { unstable_cache } from 'next/cache'
import { SYMBOL_PATTERN, type MarketQuote } from '@nexo/shared/investments'
import type { InvestmentAssetType, InvestmentCurrency, InvestmentPosition } from '@nexo/shared/types'
import { MARKET_RANGES, type MarketRange } from './input'

const yahoo = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  fetch: (input, init) => fetch(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(6500)]) : AbortSignal.timeout(6500),
  }),
})
const USD_COP = 'USDCOP=X'
const BATCH_SIZE = 45

function yahooAsset(quoteType: unknown): InvestmentAssetType | null {
  switch (quoteType) {
    case 'EQUITY': return 'stock'
    case 'ETF':
    case 'MUTUALFUND':
    case 'MONEYMARKET': return 'fund'
    case 'CRYPTOCURRENCY': return 'crypto'
    case 'BOND': return 'fixed_income'
    case 'INDEX':
    case 'FUTURE':
    case 'OPTION':
    case 'CURRENCY': return 'other'
    default: return null
  }
}

function currencyUnit(raw: string | undefined) {
  if (!raw) return null
  if (raw === 'GBp' || raw === 'GBX') return { code: 'GBP', scale: 0.01 }
  if (raw === 'ZAc' || raw === 'ZAC') return { code: 'ZAR', scale: 0.01 }
  if (raw === 'ILA' || raw === 'ILa') return { code: 'ILS', scale: 0.01 }
  const code = raw.toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? { code, scale: 1 } : null
}

type RawQuote = { price: number; sourceCurrency: string; asOf: string; change: number | null; assetType: InvestmentAssetType | null }

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function rawQuote(price: unknown, currency: string | undefined, date: unknown, change: unknown, type: unknown): RawQuote | null {
  const unit = currencyUnit(currency)
  if (!positive(price) || !unit || !(date instanceof Date) || !Number.isFinite(date.getTime())) return null
  return {
    price: price * unit.scale,
    sourceCurrency: unit.code,
    asOf: date.toISOString(),
    change: typeof change === 'number' && Number.isFinite(change) ? change : null,
    assetType: yahooAsset(type),
  }
}

async function quoteBatch(symbols: string[]) {
  const quotes = new Map<string, RawQuote>()
  try {
    const response = await yahoo.quote(symbols, {
      fields: ['symbol', 'currency', 'regularMarketPrice', 'regularMarketTime', 'regularMarketChangePercent', 'quoteType'],
    })
    for (const entry of response) {
      const quote = rawQuote(entry.regularMarketPrice, entry.currency, entry.regularMarketTime, entry.regularMarketChangePercent, entry.quoteType)
      if (quote) quotes.set(entry.symbol.toUpperCase(), quote)
    }
  } catch {
    // Yahoo sometimes serves chart data when the quote endpoint is unavailable.
  }
  return quotes
}

const recentChart = unstable_cache(async (symbol: string): Promise<RawQuote | null> => {
  const data = await yahoo.chart(symbol, { period1: new Date(Date.now() - 9 * 86_400_000), interval: '1d' })
  const { regularMarketPrice, regularMarketTime, currency, instrumentType, previousClose, chartPreviousClose } = data.meta
  const closes = data.quotes.filter((point) => positive(point.close))
  const before = closes.at(-2)?.close ?? previousClose ?? chartPreviousClose
  const change = positive(before) ? (regularMarketPrice / before - 1) * 100 : null
  return rawQuote(regularMarketPrice, currency, regularMarketTime, change, instrumentType)
}, ['investment-recent-chart-v1'], { revalidate: 120 })

async function fetchRawQuotes(symbols: string[]) {
  const output = new Map<string, RawQuote>()
  for (let offset = 0; offset < symbols.length; offset += BATCH_SIZE) {
    for (const [symbol, quote] of await quoteBatch(symbols.slice(offset, offset + BATCH_SIZE))) output.set(symbol, quote)
  }
  const missing = symbols.filter((symbol) => !output.has(symbol))
  for (let offset = 0; offset < missing.length; offset += 8) {
    await Promise.all(missing.slice(offset, offset + 8).map(async (symbol) => {
      try {
        const quote = await recentChart(symbol)
        if (quote) output.set(symbol, quote)
      } catch {
        // The last saved quote or the manual price remains available.
      }
    }))
  }
  return output
}

export async function fetchMarket(symbols: string[]) {
  const data = await fetchRawQuotes([...new Set([...symbols, USD_COP])])
  const rates = await fetchRawQuotes([...new Set([...data.values()].map((quote) => quote.sourceCurrency)
    .filter((currency) => currency !== 'COP' && currency !== 'USD'))].map((currency) => `${currency}USD=X`))
  const quotes: Record<string, MarketQuote> = {}
  for (const symbol of symbols) {
    const quote = data.get(symbol)
    if (!quote) continue
    const currency = quote.sourceCurrency === 'COP' ? 'COP' : 'USD'
    const rate = quote.sourceCurrency === 'COP' || quote.sourceCurrency === 'USD'
      ? 1 : rates.get(`${quote.sourceCurrency}USD=X`)?.price
    if (!positive(rate)) continue
    quotes[symbol] = { price: quote.price * rate, currency, asOf: quote.asOf, change: quote.change, assetType: quote.assetType }
  }
  const fx = data.get(USD_COP)
  return fx && fx.sourceCurrency === 'COP' && fx.price < 1_000_000
    ? { quotes, usdCop: fx.price, rateAt: fx.asOf }
    : { quotes, usdCop: null, rateAt: null }
}

export type MarketSearchResult = { symbol: string; name: string; exchange: string; assetType: InvestmentAssetType | null }

const cachedSearch = unstable_cache(async (query: string): Promise<MarketSearchResult[]> => {
  const response = await yahoo.search(query, { quotesCount: 8, newsCount: 0 })
  return response.quotes.flatMap((entry) => {
    if (!entry.isYahooFinance) return []
    const symbol = entry.symbol?.toUpperCase()
    if (!symbol || !SYMBOL_PATTERN.test(symbol)) return []
    return [{
      symbol,
      name: entry.longname || entry.shortname || symbol,
      exchange: entry.exchDisp || entry.exchange || '',
      assetType: yahooAsset(entry.quoteType),
    }]
  })
}, ['investment-search-v1'], { revalidate: 900 })

export const searchMarket = cachedSearch

type PricePoint = { day: string; price: number }
type DailySeries = { currency: string; points: PricePoint[] }
export type HistoryPoint = { day: string; value: number }
export type PortfolioHistory = { points: HistoryPoint[]; covered: number; total: number }

const dailyChart = unstable_cache(async (symbol: string, day: string, days: number): Promise<DailySeries> => {
  const end = new Date(`${day}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  const start = new Date(end.getTime() - (days + 9) * 86_400_000)
  const result = await yahoo.chart(symbol, { period1: start, period2: end, interval: '1d' })
  const unit = currencyUnit(result.meta.currency)
  if (!unit) return { currency: '', points: [] }
  const formatDay = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: result.meta.exchangeTimezoneName || 'UTC',
  })
  const points: PricePoint[] = []
  for (const quote of result.quotes) {
    if (positive(quote.close)) points.push({ day: formatDay.format(quote.date), price: quote.close * unit.scale })
  }
  return { currency: unit.code, points }
}, ['investment-daily-chart-v1'], { revalidate: 3600 })

function carryForward(points: PricePoint[]) {
  let cursor = -1
  return (day: string) => {
    while (cursor + 1 < points.length && points[cursor + 1].day <= day) cursor += 1
    const point = points[cursor]
    if (!point || Date.parse(day) - Date.parse(point.day) > 7 * 86_400_000) return null
    return point.price
  }
}

export async function fetchPortfolioHistory(positions: InvestmentPosition[], range: MarketRange, currency: InvestmentCurrency): Promise<PortfolioHistory> {
  const active = positions.filter((position) => position.quantity > 0)
  const symbols = [...new Set(active.flatMap((position) => position.symbol ? [position.symbol] : []))]
  if (!symbols.length) return { points: [], covered: 0, total: active.length }
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const days = MARKET_RANGES[range]
  const firstDay = new Date(Date.parse(day) - (days - 1) * 86_400_000).toISOString().slice(0, 10)

  const markets = new Map<string, DailySeries>()
  for (let offset = 0; offset < symbols.length; offset += 8) {
    const batch = await Promise.allSettled(symbols.slice(offset, offset + 8).map(async (symbol) =>
      [symbol, await dailyChart(symbol, day, days)] as const))
    for (const result of batch) {
      if (result.status === 'fulfilled' && result.value[1].points.some((point) => point.day >= firstDay)) markets.set(...result.value)
    }
  }

  function fxPairs(source: string) {
    if (source === currency) return []
    if (source === 'USD' || source === 'COP') return [USD_COP]
    return currency === 'COP' ? [`${source}USD=X`, USD_COP] : [`${source}USD=X`]
  }
  const fxSymbols = [...new Set([...markets.values()].flatMap(({ currency: source }) => fxPairs(source)))]
  const rateSeries = new Map<string, DailySeries>()
  const rates = await Promise.allSettled(fxSymbols.map(async (symbol) => [symbol, await dailyChart(symbol, day, days)] as const))
  for (const result of rates) {
    if (result.status === 'fulfilled' && result.value[1].points.some((point) => point.day >= firstDay)) rateSeries.set(...result.value)
  }

  let covered = 0
  const amounts = new Map<string, number>()
  for (const position of active) {
    const series = position.symbol ? markets.get(position.symbol) : null
    if (!series || !position.symbol) continue
    if (fxPairs(series.currency).some((pair) => !rateSeries.has(pair))) continue
    amounts.set(position.symbol, (amounts.get(position.symbol) ?? 0) + position.quantity)
    covered += 1
  }
  const sources = [...amounts].map(([symbol, quantity]) => {
    const series = markets.get(symbol)!
    const rateAt = fxPairs(series.currency).map((pair) => carryForward(rateSeries.get(pair)!.points))
    return { quantity, series, priceAt: carryForward(series.points), rateAt }
  })
  const daysWithPrices = [...new Set(sources.flatMap(({ series }) =>
    series.points.map((point) => point.day).filter((date) => date >= firstDay && date <= day)))].sort()
  const points: HistoryPoint[] = []
  for (const date of daysWithPrices) {
    let value = 0
    let complete = true
    for (const source of sources) {
      const price = source.priceAt(date)
      const rate = source.rateAt.reduce<number | null>((product, at) => {
        const next = at(date)
        return product === null || next === null ? null : product * next
      }, 1)
      if (price === null || rate === null) {
        complete = false
        break
      }
      const converted = source.series.currency === 'COP' && currency === 'USD' ? price / rate : price * rate
      value += source.quantity * converted
    }
    if (complete && positive(value)) points.push({ day: date, value })
  }

  return { points, covered, total: active.length }
}

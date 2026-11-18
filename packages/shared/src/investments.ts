import type {
  InvestmentAssetType,
  InvestmentCurrency,
  InvestmentPosition,
} from './types'

export const ASSET_LABELS: Record<InvestmentAssetType, string> = {
  fund: 'ETF / Fondo',
  stock: 'Acción',
  fixed_income: 'Bono / Renta fija',
  crypto: 'Cripto',
  cash: 'Efectivo',
  real_estate: 'Inmueble / Crowd',
  other: 'Otro',
}

const RISK: Record<InvestmentAssetType, number> = {
  cash: 1, fixed_income: 2, fund: 3, real_estate: 3, other: 3, stock: 4, crypto: 5,
}

export const SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.^=/_-]{0,31}$/

export type MarketQuote = {
  price: number
  currency: InvestmentCurrency
  asOf: string
  change: number | null
  assetType: InvestmentAssetType | null
}

export type MarketSnapshot = {
  quotes: Record<string, MarketQuote>
  usdCop: number | null
  rateAt: string | null
  checkedAt: string | null
}

export type ValuedPosition = InvestmentPosition & {
  price: number | null
  value: number | null
  cost: number | null
  gain: number | null
  returnPct: number | null
  quote: MarketQuote | null
  displayAssetType: InvestmentAssetType
  source: 'yahoo' | 'manual' | null
}

export function convertInvestmentAmount(
  value: number,
  from: InvestmentCurrency,
  to: InvestmentCurrency,
  usdCop: number | null,
): number | null {
  if (!Number.isFinite(value)) return null
  if (value === 0 || from === to) return value
  if (usdCop === null || !Number.isFinite(usdCop) || usdCop <= 0) return null
  return from === 'USD' ? value * usdCop : value / usdCop
}

export function valuePositions(
  positions: InvestmentPosition[],
  market: MarketSnapshot,
  currency: InvestmentCurrency,
): ValuedPosition[] {
  return positions.map((position) => {
    const quote = position.symbol ? market.quotes[position.symbol] ?? null : null
    const marketPrice = quote
      ? convertInvestmentAmount(quote.price, quote.currency, currency, market.usdCop)
      : null
    const manualPrice = position.manual_price === null ? null
      : convertInvestmentAmount(position.manual_price, position.manual_currency, currency, market.usdCop)
    const price = marketPrice ?? manualPrice
    const value = position.quantity === 0 ? 0 : price === null ? null : position.quantity * price
    const cost = position.quantity === 0 ? 0 : position.average_price === null ? null
      : convertInvestmentAmount(position.quantity * position.average_price, position.cost_currency, currency, market.usdCop)
    const gain = value === null || cost === null ? null : value - cost
    return {
      ...position, price, value, cost, gain,
      quote: marketPrice === null ? null : quote,
      displayAssetType: position.asset_type === 'other' ? quote?.assetType ?? 'other' : position.asset_type,
      source: marketPrice !== null ? 'yahoo' : manualPrice !== null ? 'manual' : null,
      returnPct: gain !== null && cost !== null && cost > 0 ? gain / cost * 100 : null,
    }
  })
}

export function summarizePositions(rows: ValuedPosition[]) {
  const active = rows.filter((row) => row.quantity > 0)
  const priced = active.filter((row) => row.value !== null)
  const total = priced.reduce((sum, row) => sum + (row.value ?? 0), 0)
  const withCost = priced.filter((row) => row.cost !== null)
  const comparableCost = withCost.reduce((sum, row) => sum + (row.cost ?? 0), 0)
  const gain = withCost.reduce((sum, row) => sum + (row.gain ?? 0), 0)
  const cost = active.reduce((sum, row) => sum + (row.cost ?? 0), 0)
  const knownCosts = active.filter((row) => row.cost !== null).length

  const allocation = new Map<InvestmentAssetType, number>()
  const exposure = new Map<string, number>()
  let risk = 0
  for (const position of priced) {
    const value = position.value ?? 0
    if (value <= 0) continue
    allocation.set(position.displayAssetType, (allocation.get(position.displayAssetType) ?? 0) + value)
    const key = position.symbol ?? position.name.trim().toLowerCase()
    exposure.set(key, (exposure.get(key) ?? 0) + value)
    risk += value * RISK[position.displayAssetType]
  }
  const topExposure = [...exposure].sort((a, b) => b[1] - a[1])[0]
  const largestShare = total > 0 && topExposure ? topExposure[1] / total : 0
  const cryptoShare = total > 0 ? (allocation.get('crypto') ?? 0) / total : 0
  const diversification = total === 0 ? null : Math.round(Math.max(0, Math.min(100,
    50 + Math.min(20, exposure.size * 3) + Math.min(15, allocation.size * 4)
    - (largestShare > 0.6 ? 20 : largestShare > 0.4 ? 10 : 0)
    - (cryptoShare > 0.4 ? 15 : cryptoShare > 0.2 ? 5 : 0),
  )))
  return {
    active: active.length,
    priced: priced.length,
    withCost: withCost.length,
    knownCosts,
    total: active.length > 0 && priced.length === 0 ? null : total,
    cost: active.length > 0 && knownCosts === 0 ? null : cost,
    gain: withCost.length ? gain : null,
    returnPct: comparableCost > 0 ? gain / comparableCost * 100 : null,
    risk: total > 0 ? risk / total : null,
    diversification,
    topExposure: topExposure ? { name: topExposure[0], percent: largestShare * 100 } : null,
    allocation: [...allocation].map(([type, value]) => ({ type, value, percent: value / total * 100 }))
      .sort((a, b) => b.value - a.value),
  }
}

type AccountValue = { id: string; balance: number; currency: string; type: string }

export function investmentNetWorth(
  balances: AccountValue[],
  positions: ValuedPosition[],
  usdCop: number | null,
) {
  const eligible = new Map(balances.filter((account) => account.type !== 'credit' && account.balance >= 0)
    .map((account) => [account.id, { count: 0, complete: true }]))
  for (const position of positions) {
    const group = position.account_id ? eligible.get(position.account_id) : undefined
    if (!group || position.quantity <= 0) continue
    group.count += 1
    if (position.value === null) group.complete = false
  }
  const replaced = new Set<string>()
  for (const [id, { count, complete }] of eligible) {
    if (count && complete) replaced.add(id)
  }

  let accounts = 0
  let missingAccounts = 0
  for (const account of balances) {
    if (replaced.has(account.id)) continue
    const currency = account.currency.toUpperCase()
    const value = currency === 'COP' || currency === 'USD'
      ? convertInvestmentAmount(account.balance, currency, 'COP', usdCop)
      : null
    if (value === null) missingAccounts += 1
    else accounts += value
  }

  let investments = 0
  let missingPositions = 0
  let coveredByBalance = 0
  for (const position of positions) {
    if (position.quantity <= 0) continue
    const group = position.account_id ? eligible.get(position.account_id) : undefined
    if (group && !group.complete) {
      coveredByBalance += 1
      continue
    }
    if (position.value === null) missingPositions += 1
    else investments += position.value
  }
  return { accounts, investments, total: accounts + investments, missingAccounts, missingPositions, coveredByBalance, replaced }
}

export function historyStats(values: number[]) {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return { drawdown: null, volatility: null, sharpe: null }
  }
  let peak = values[0]
  let drawdown = 0
  const returns = values.slice(1).map((value, index) => {
    peak = Math.max(peak, value)
    drawdown = Math.min(drawdown, (value / peak - 1) * 100)
    return value / values[index] - 1
  })
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / returns.length
  const dailyVolatility = Math.sqrt(variance)
  return {
    drawdown,
    volatility: returns.length >= 2 ? dailyVolatility * Math.sqrt(252) * 100 : null,
    sharpe: returns.length >= 2 && dailyVolatility > 0 ? average / dailyVolatility * Math.sqrt(252) : null,
  }
}

export function projectInvestment(start: number, monthly: number, annualPct: number, years: number) {
  const monthlyRate = Math.expm1(Math.log1p(annualPct / 100) / 12)
  let value = start
  const points = [start]
  for (let month = 1; month <= years * 12; month += 1) {
    value = value * (1 + monthlyRate) + monthly
    if (month % 12 === 0) points.push(value)
  }
  const contributed = start + monthly * years * 12
  return { value, contributed, growth: value - contributed, points }
}

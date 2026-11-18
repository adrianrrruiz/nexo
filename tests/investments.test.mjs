import { test } from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { z } from 'zod'
import { load } from './load.mjs'

const {
  historyStats, investmentNetWorth, projectInvestment, summarizePositions, valuePositions,
} = load('packages/shared/src/investments.ts')
const { CSV_TEMPLATE, parseInvestmentImport } = load('src/lib/investments/import.ts', {
  papaparse: { default: Papa },
  zod: { z },
})
const { savePosition, importPositions } = load('src/app/(app)/inversiones/actions.ts', {
  'node:crypto': await import('node:crypto'),
  'next/cache': { revalidatePath: () => {} },
  'zod': { z },
  '@/lib/supabase/server': { createClient: () => client },
  '@/lib/investments/data': {},
  '@/lib/investments/market': {},
  '@/lib/investments/input': load('src/lib/investments/input.ts', { zod: { z } }),
})

const asOf = '2026-11-15T20:00:00.000Z'
const market = {
  usdCop: 4000, checkedAt: asOf, rateAt: asOf,
  quotes: { TEST: { price: 12.5, currency: 'USD', change: 2, assetType: 'stock', asOf } },
}
const holding = (extra = {}) => ({
  id: 'a', name: 'Acción de prueba', symbol: 'TEST', quantity: 2, average_price: 40000,
  asset_type: 'stock', cost_currency: 'COP', manual_price: null, manual_currency: 'COP', account_id: null,
  ...extra,
})
const cash = (id, balance, currency = 'COP', type = 'debit') => ({ id, balance, currency, type })

test('values positions in COP and USD with comparable cost and return', () => {
  const rows = valuePositions([holding()], market, 'COP')
  assert.equal(rows[0].value, 100000)
  assert.equal(rows[0].cost, 80000)
  assert.equal(rows[0].returnPct, 25)
  const converted = valuePositions([holding()], market, 'USD')
  assert.equal(converted[0].value, 25)
  assert.equal(converted[0].cost, 20)
})

test('missing FX does not treat COP as USD or discard compatible manual prices', () => {
  const unavailable = { ...market, usdCop: null }
  const usd = valuePositions([holding()], unavailable, 'USD')[0]
  assert.equal(usd.value, 25)
  assert.equal(usd.cost, null)
  assert.equal(usd.returnPct, null)
  const cop = valuePositions([holding({ manual_price: 46000 })], unavailable, 'COP')[0]
  assert.equal(cop.value, 92000)
  assert.equal(cop.source, 'manual')
})

test('unclassified symbols show their Yahoo asset type and explicit edits win', () => {
  const rows = valuePositions([holding({ asset_type: 'other' }), holding({ asset_type: 'fund' })], market, 'COP')
  assert.equal(rows[0].displayAssetType, 'stock')
  assert.equal(rows[1].displayAssetType, 'fund')
})

test('only positions with price and cost contribute to aggregate return', () => {
  const rows = valuePositions([holding(), holding({ id: 'b', average_price: null })], market, 'COP')
  const summary = summarizePositions(rows)
  assert.equal(summary.total, 200000)
  assert.equal(summary.gain, 20000)
  assert.equal(summary.returnPct, 25)
  assert.equal(summary.withCost, 1)
  assert.equal(summary.topExposure.percent, 100)
})

test('replaces a linked balance once when all active lots are priced and preserves debt', () => {
  const balances = [cash('broker', 60000), cash('bank', 200000), cash('card', -50000, 'COP', 'credit')]
  const positions = valuePositions([
    holding({ account_id: 'broker' }),
    holding({ id: 'b', account_id: 'broker', symbol: 'NOT-PRICED', quantity: 0 }),
  ], market, 'COP')
  const result = investmentNetWorth(balances, positions, 4000)
  assert.equal(result.accounts, 150000)
  assert.equal(result.investments, 100000)
  assert.equal(result.total, 250000)
  assert.equal(result.replaced.size, 1)
})

test('uses the linked balance when a lot is pending and flags uncovered positions or accounts', () => {
  const balances = [cash('broker', 60000), cash('unconverted', 10, 'USD')]
  const positions = valuePositions([
    holding({ account_id: 'broker', symbol: null, manual_price: 10000 }),
    holding({ id: 'b', account_id: 'broker', symbol: 'NO-DATA' }),
    holding({ id: 'c', symbol: 'NO-DATA' }),
  ], { ...market, usdCop: null }, 'COP')
  const result = investmentNetWorth(balances, positions, null)
  assert.equal(result.total, 60000)
  assert.equal(result.investments, 0)
  assert.equal(result.coveredByBalance, 2)
  assert.equal(result.missingPositions, 1)
  assert.equal(result.missingAccounts, 1)
})

test('invalid history produces unavailable metrics and the simulator compounds consistently', () => {
  assert.equal(historyStats([100, 0, 100]).volatility, null)
  assert.ok(Math.abs(historyStats([100, 125, 100]).drawdown + 20) < 1e-8)
  assert.equal(projectInvestment(100, 10, 0, 2).value, 340)
  assert.ok(Math.abs(projectInvestment(100, 0, 12, 1).value - 112) < 1e-8)
})

test('reads quoted Yahoo CSV, localized semicolon CSV and the template', () => {
  const yahoo = parseInvestmentImport('Symbol,Quantity,Purchase Price,Quote Price\n"AAPL",2,123.45,150', 'USD')
  assert.equal(yahoo.positions[0].symbol, 'AAPL')
  assert.equal(yahoo.positions[0].average_price, 123.45)
  assert.equal(yahoo.positions[0].manual_price, 150)
  const local = parseInvestmentImport('\uFEFFSímbolo;Cantidad;Precio Medio;Moneda;Nombre\nTEST;2,5;1.234,56;COP;"Empresa; clase A"', 'USD')
  assert.equal(local.positions[0].quantity, 2.5)
  assert.equal(local.positions[0].average_price, 1234.56)
  assert.equal(local.positions[0].name, 'Empresa; clase A')
  assert.equal(local.positions[0].cost_currency, 'COP')
  assert.equal(parseInvestmentImport(CSV_TEMPLATE, 'USD').errors.length, 0)
})

test('Yahoo transactions preserve watch rows and include buy commissions in the cost basis', () => {
  const file = 'Symbol,Quantity,Purchase Price,Current Price,Commission,Transaction Type\nABC,2,100,130,4,BUY\nWATCH,,,20,,'
  const result = parseInvestmentImport(file, 'USD')
  assert.equal(result.errors.length, 0)
  assert.equal(result.positions[0].average_price, 102)
  assert.equal(result.positions[1].quantity, 0)
  assert.equal(result.positions[1].average_price, null)
  assert.equal(parseInvestmentImport('Symbol,Quantity,Transaction Type\nABC,2,SELL', 'USD').errors.length, 1)
})

test('legacy backup keeps the original price currencies and excludes example positions', () => {
  const file = JSON.stringify({ state: { holdings: [
    { id: 'e1', symbol: 'MOCK' },
    { id: 'z9', nombre: 'Prueba', symbol: ' test ', tipo: 'Inmueble / Crowd', cantidad: 5,
      precioMedio: 72000, monedaMedio: 'COP', precioManual: 17 },
  ] } })
  const result = parseInvestmentImport(file, 'USD')
  assert.equal(result.errors.length, 0)
  assert.equal(result.positions.length, 1)
  assert.equal(result.positions[0].symbol, 'TEST')
  assert.equal(result.positions[0].asset_type, 'real_estate')
  assert.equal(result.positions[0].cost_currency, 'COP')
  assert.equal(result.positions[0].manual_currency, 'USD')
  assert.equal(parseInvestmentImport('Symbol,Quantity\nTEST,abc', 'COP').errors.length, 1)
})

const records = []
let signedIn = true
const client = {
  auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null } }) },
  from(name) {
    assert.equal(name, 'investment_positions')
    return {
      insert: async (position) => { records.push(position); return { error: null } },
      upsert: async (positions, options) => {
        records.push(...positions)
        assert.equal(options.ignoreDuplicates, true)
        return { count: positions.length, error: null }
      },
    }
  },
}

function validPosition() {
  return holding()
}

test('the authenticated owner is imposed on saved positions and expired sessions cannot write', async () => {
  records.length = 0
  assert.equal((await savePosition({ ...validPosition(), user_id: 'forged' })).ok, true)
  assert.equal(records[0].user_id, 'owner')
  signedIn = false
  try {
    assert.match((await savePosition(validPosition())).error, /sesión/)
    assert.equal(records.length, 1)
  } finally {
    signedIn = true
  }
})

test('import IDs are stable on retry and retain identical lots inside a file', async () => {
  records.length = 0
  const file = [validPosition(), validPosition()]
  assert.equal((await importPositions(file)).count, 2)
  assert.equal((await importPositions(file)).count, 2)
  assert.notEqual(records[0].id, records[1].id)
  assert.equal(records[0].id, records[2].id)
  assert.equal(records[1].id, records[3].id)
})

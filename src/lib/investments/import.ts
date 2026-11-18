import Papa from 'papaparse'
import { ASSET_LABELS } from '@nexo/shared/investments'
import type { InvestmentAssetType, InvestmentCurrency, InvestmentPositionInput } from '@nexo/shared/types'
import { MAX_IMPORT_ROWS, parseInvestmentNumber, positionSchema } from './input'

export const CSV_TEMPLATE = [
  'symbol,cantidad,precioMedio,monedaMedio,nombre,tipo,precioManual,monedaManual',
  'EJEMPLO,2.5,100,USD,Posición de ejemplo,Acción,,USD',
].join('\r\n') + '\r\n'

const columns = {
  symbol: ['symbol', 'simbolo', 'ticker', 'codigo'],
  name: ['nombre', 'name', 'activo', 'descripcion', 'security name'],
  quantity: ['cantidad', 'quantity', 'shares', 'unidades', 'units'],
  cost: ['preciomedio', 'averageprice', 'avgprice', 'purchaseprice', 'preciocompra', 'pricepaid', 'costpershare', 'tradeprice', 'costo unitario'],
  costCurrency: ['monedamedio', 'costcurrency', 'currency', 'moneda', 'divisa'],
  manualPrice: ['preciomanual', 'manualprice', 'quoteprice', 'currentprice', 'precioactual', 'marketprice'],
  manualCurrency: ['monedamanual', 'manualcurrency', 'quotecurrency'],
  type: ['tipo', 'type', 'assettype', 'categoria'],
  transaction: ['transactiontype', 'tipotransaccion'],
  commission: ['commission', 'comision'],

}

function normalized(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeAsset(value: string): InvestmentAssetType {
  const aliases: Record<string, InvestmentAssetType> = {
    stock: 'stock', equity: 'stock', accion: 'stock', etf: 'fund', fondo: 'fund', fund: 'fund',
    bond: 'fixed_income', bono: 'fixed_income', fixedincome: 'fixed_income',
    crypto: 'crypto', cryptocurrency: 'crypto', criptomoneda: 'crypto',
    cash: 'cash', realestate: 'real_estate', inmueble: 'real_estate',
  }
  const key = normalized(value)
  const labeled = Object.entries(ASSET_LABELS).find(([type, label]) => normalized(label) === key || normalized(type) === key)
  return labeled ? labeled[0] as InvestmentAssetType : aliases[key] ?? 'other'
}

type ImportResult = { positions: InvestmentPositionInput[]; errors: string[] }

export function parseInvestmentImport(text: string, defaultCurrency: InvestmentCurrency): ImportResult {
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return { positions: [], errors: ['El archivo está vacío.'] }
  return clean.startsWith('{') || clean.startsWith('[')
    ? parseLegacy(clean, defaultCurrency)
    : parseCsv(clean, defaultCurrency)
}

function parseCsv(text: string, defaultCurrency: InvestmentCurrency): ImportResult {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t'],
  })
  const [header, ...rows] = result.data
  if (!header) return { positions: [], errors: ['El CSV no tiene encabezados.'] }
  const keys = header.map(normalized)
  const indexes = Object.fromEntries(Object.entries(columns).map(([key, aliases]) =>
    [key, keys.findIndex((value) => aliases.some((alias) => normalized(alias) === value))]))
  if (indexes.quantity < 0 || (indexes.symbol < 0 && indexes.name < 0)) {
    return { positions: [], errors: ['El CSV necesita una columna de cantidad y otra de símbolo o nombre.'] }
  }
  if (rows.length > MAX_IMPORT_ROWS) return rowLimit()
  if (result.errors.length) return { positions: [], errors: ['Hay comillas o separadores inválidos en el CSV.'] }
  const locale = result.meta.delimiter === ';' ? 'decimal-comma' : 'decimal-dot'
  const output: ImportResult = { positions: [], errors: [] }
  rows.forEach((row, index) => {
    if (row.length !== header.length) {
      output.errors.push(`Fila ${index + 2}: el número de columnas no coincide con los encabezados.`)
      return
    }
    const get = (column: keyof typeof columns) => row[indexes[column]]?.trim() ?? ''
    const transaction = normalized(get('transaction'))
    if (transaction && transaction !== 'buy' && transaction !== 'compra') {
      output.errors.push(`Fila ${index + 2}: usa las posiciones vigentes para importar archivos con ventas u otros movimientos.`)
      return
    }
    const quantity = parseInvestmentNumber(get('quantity'), locale)
    const cost = parseInvestmentNumber(get('cost'), locale)
    const manualPrice = parseInvestmentNumber(get('manualPrice'), locale)
    const commission = parseInvestmentNumber(get('commission'), locale)
    const watch = indexes.transaction >= 0 && !transaction && quantity === null && cost === null
      && manualPrice !== null && Boolean(get('symbol'))
    if (commission !== null && (!Number.isFinite(commission) || quantity === null || quantity <= 0 || cost === null)) {
      output.errors.push(`Fila ${index + 2}: revisa la comisión, el precio de compra y la cantidad.`)
      return
    }
    const unitCost = commission && cost !== null && quantity ? cost + commission / quantity : cost
    appendPosition(output, index + 2, {
      name: get('name') || get('symbol'),
      symbol: get('symbol') || null,
      asset_type: normalizeAsset(get('type')),
      quantity: watch ? 0 : quantity,
      average_price: unitCost,
      cost_currency: get('costCurrency').toUpperCase() || defaultCurrency,
      manual_price: manualPrice,
      manual_currency: get('manualCurrency').toUpperCase() || get('costCurrency').toUpperCase() || defaultCurrency,
      account_id: null,
    })
  })
  return output
}

function parseLegacy(text: string, defaultCurrency: InvestmentCurrency): ImportResult {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { positions: [], errors: ['El respaldo JSON tiene un formato inválido.'] }
  }
  const rows: unknown = Array.isArray(data) ? data : data?.state?.holdings ?? data?.holdings
  if (!Array.isArray(rows)) return { positions: [], errors: ['El respaldo JSON debe contener las posiciones del portafolio.'] }
  if (rows.length > MAX_IMPORT_ROWS) return rowLimit()
  const output: ImportResult = { positions: [], errors: [] }
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      output.errors.push(`Posición ${index + 1}: registro inválido.`)
      return
    }
    if (['e1', 'e2', 'e3', 'e4', 'e5'].includes(row.id)) return
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : ''
    const name = typeof row.nombre === 'string' ? row.nombre.trim() : typeof row.name === 'string' ? row.name.trim() : ''
    appendPosition(output, index + 1, {
      name: name || symbol,
      symbol: symbol || null,
      asset_type: normalizeAsset(typeof row.tipo === 'string' ? row.tipo : ''),
      quantity: row.cantidad,
      average_price: row.precioMedio ?? null,
      cost_currency: row.monedaMedio ?? defaultCurrency,
      manual_price: row.precioManual ?? null,
      manual_currency: row.monedaManual ?? 'USD',
      account_id: null,
    })
  })
  return output
}

function appendPosition(output: ImportResult, line: number, row: unknown) {
  const parsed = positionSchema.safeParse(row)
  if (parsed.success) {
    output.positions.push(parsed.data)
  } else {
    const fields = {
      name: 'nombre', symbol: 'símbolo', quantity: 'cantidad', average_price: 'precio medio',
      cost_currency: 'moneda del costo', manual_price: 'precio manual', manual_currency: 'moneda del precio manual',
    } as Record<string, string>
    const field = String(parsed.error.issues[0]?.path[0] ?? '')
    output.errors.push(`Registro ${line}: revisa ${fields[field] ?? 'los datos de la posición'}.`)
  }
}

function rowLimit(): ImportResult {
  return { positions: [], errors: [`El archivo admite hasta ${MAX_IMPORT_ROWS} posiciones por importación.`] }
}

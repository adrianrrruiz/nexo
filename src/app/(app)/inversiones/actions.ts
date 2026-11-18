'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getInvestmentData, getPositions } from '@/lib/investments/data'
import { currencySchema, MAX_IMPORT_ROWS, positionSchema, positionVersion, rangeSchema } from '@/lib/investments/input'
import { fetchMarket, fetchPortfolioHistory, searchMarket } from '@/lib/investments/market'
import type { InvestmentPositionInput } from '@nexo/shared/types'

async function getOwner() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return { client, user }
}

type MutationResult = { ok: true } | { error: string }

const sessionError = { error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }
const changed = { error: 'La posición cambió en otra sesión. Recarga los datos e inténtalo de nuevo.' }

function refreshViews() {
  revalidatePath('/inversiones')
  revalidatePath('/dashboard')
}

export async function savePosition(input: unknown, version?: unknown): Promise<MutationResult> {
  const position = positionSchema.safeParse(input)
  const existing = version === undefined ? null : positionVersion.safeParse(version)
  if (!position.success || (existing && !existing.success)) {
    return { error: 'Revisa el nombre, símbolo, cantidad y precios de la posición.' }
  }
  const { client, user } = await getOwner()
  if (!user) return sessionError
  if (position.data.account_id) {
    const { data: account, error } = await client.from('accounts').select('id')
      .eq('user_id', user.id).eq('id', position.data.account_id)
      .eq('archived', false).neq('type', 'credit').maybeSingle()
    if (error || !account) return { error: 'Elige una cuenta activa que puedas vincular.' }
  }

  if (existing?.success) {
    const { data, error } = await client.from('investment_positions').update(position.data)
      .eq('id', existing.data.id).eq('user_id', user.id).eq('updated_at', existing.data.updated_at)
      .select('id').maybeSingle()
    if (error) return { error: 'No se pudo guardar la posición.' }
    if (!data) return changed
  } else {
    const { error } = await client.from('investment_positions').insert({ ...position.data, user_id: user.id })
    if (error) return { error: 'No se pudo guardar la posición.' }
  }
  refreshViews()
  return { ok: true }
}

export async function removePosition(version: unknown): Promise<MutationResult> {
  const position = positionVersion.safeParse(version)
  if (!position.success) return { error: 'La posición no es válida.' }
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const { data, error } = await client.from('investment_positions').delete()
    .eq('id', position.data.id).eq('user_id', user.id).eq('updated_at', position.data.updated_at)
    .select('id').maybeSingle()
  if (error) return { error: 'No se pudo eliminar la posición.' }
  if (!data) return changed
  refreshViews()
  return { ok: true }
}

export async function removeZeroPositions() {
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const { error, count } = await client.from('investment_positions').delete({ count: 'exact' })
    .eq('user_id', user.id).eq('quantity', 0)
  if (error) return { error: 'No se pudieron quitar las posiciones con cantidad cero.' }
  refreshViews()
  return { ok: true, count: count ?? 0 }
}

function importId(userId: string, position: InvestmentPositionInput, occurrence: number) {
  // Stable on retries, while letting a file contain more than one identical lot.
  const hex = createHash('sha256').update(JSON.stringify([userId, position, occurrence])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export async function importPositions(input: unknown) {
  const checked = z.array(positionSchema.extend({ account_id: z.null() })).min(1).max(MAX_IMPORT_ROWS).safeParse(input)
  if (!checked.success) return { error: 'Revisa la vista previa del archivo antes de importar.' }
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const occurrences = new Map<string, number>()
  const records = checked.data.map((position) => {
    const key = JSON.stringify(position)
    const occurrence = (occurrences.get(key) ?? 0) + 1
    occurrences.set(key, occurrence)
    return { ...position, user_id: user.id, id: importId(user.id, position, occurrence) }
  })
  const { error, count } = await client.from('investment_positions')
    .upsert(records, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' })
  if (error) return { error: 'No se pudo importar el archivo. Tus posiciones actuales siguen guardadas.' }
  refreshViews()
  return { ok: true, count: count ?? 0 }
}

export async function saveInvestmentCurrency(input: unknown) {
  const currency = currencySchema.safeParse(input)
  if (!currency.success) return { error: 'La moneda seleccionada no es válida.' }
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const { error } = await client.from('investment_preferences').upsert({ user_id: user.id, currency: currency.data })
  if (error) return { error: 'No se pudo guardar la moneda.' }
  revalidatePath('/inversiones')
  return { ok: true }
}

export async function refreshInvestmentQuotes() {
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const { positions, market, error: readError } = await getInvestmentData(client, user.id)
  if (readError) return { error: 'No se pudieron cargar las posiciones para actualizar cotizaciones.' }

  const symbols = [...new Set(positions.flatMap((position) => position.symbol ? [position.symbol] : []))]
  const checkedAt = new Date().toISOString()
  const current = await fetchMarket(symbols)
  const quotes = Object.fromEntries(symbols.flatMap((symbol) => {
    const before = market.quotes[symbol]
    const after = current.quotes[symbol]
    const price = after && (!before || after.asOf >= before.asOf) ? after : before
    return price ? [[symbol, price]] : []
  }))
  const useNewRate = current.usdCop !== null && current.rateAt !== null && (!market.rateAt || current.rateAt >= market.rateAt)
  const update = {
    checked_at: checkedAt,
    quotes,
    usd_cop: useNewRate ? current.usdCop : market.usdCop,
    rate_at: useNewRate ? current.rateAt : market.rateAt,
  }

  const { error: insertError } = await client.from('investment_market')
    .upsert({ ...update, user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (insertError) return { error: 'No se pudo guardar la actualización de cotizaciones.' }
  const { error } = await client.from('investment_market').update(update)
    .eq('user_id', user.id).lt('checked_at', checkedAt)
  if (error) return { error: 'No se pudo guardar la actualización de cotizaciones.' }

  refreshViews()
  return { ok: true, updated: Object.keys(current.quotes).length, expected: symbols.length, rate: current.usdCop !== null }
}

export async function findInvestmentSymbols(input: unknown) {
  const query = z.string().trim().min(2).max(64).safeParse(input)
  if (!query.success) return { results: [] }
  const { user } = await getOwner()
  if (!user) return sessionError
  try {
    return { results: await searchMarket(query.data) }
  } catch {
    return { error: 'Yahoo Finance no respondió. Puedes escribir el símbolo manualmente.' }
  }
}

export async function getInvestmentHistory(input: unknown, unit: unknown) {
  const range = rangeSchema.safeParse(input)
  const currency = currencySchema.safeParse(unit)
  if (!range.success || !currency.success) return { error: 'Revisa el rango y la moneda.' }
  const { client, user } = await getOwner()
  if (!user) return sessionError
  const { positions, error } = await getPositions(client, user.id)
  if (error) return { error: 'No se pudieron cargar las posiciones para el histórico.' }
  try {
    return { history: await fetchPortfolioHistory(positions, range.data, currency.data) }
  } catch {
    return { error: 'El histórico de Yahoo Finance no está disponible en este momento.' }
  }
}

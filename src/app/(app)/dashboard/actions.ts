'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TransactionType } from '@/lib/supabase/types'

export type EntryState = { ok: boolean; message: string } | null

function parseTransactionForm(formData: FormData) {
  const type = String(formData.get('type')) as TransactionType
  const amount = Number(String(formData.get('amount') || '').replace(',', '.'))
  const account_id = String(formData.get('account_id') || '')
  const rawTo = String(formData.get('to_account_id') || '')
  const rawCat = String(formData.get('category_id') || '')
  const dateStr = String(formData.get('date') || '')
  const note = String(formData.get('note') || '').trim() || null

  return { type, amount, account_id, rawTo, rawCat, dateStr, note }
}

function validateTransaction(input: ReturnType<typeof parseTransactionForm>) {
  if (!input.amount || input.amount <= 0) return 'Monto inválido.'
  if (!input.account_id) return 'Elige una cuenta.'
  if (input.type === 'transfer' && !input.rawTo) return 'Elige la cuenta destino.'
  if (input.type === 'transfer' && input.rawTo === input.account_id) {
    return 'Las cuentas deben ser distintas.'
  }
  return null
}

function dateToOccurredAt(dateStr: string) {
  return dateStr
    ? new Date(`${dateStr}T12:00:00-05:00`).toISOString()
    : new Date().toISOString()
}

/** Crea un movimiento manual (gasto / ingreso / transferencia). */
export async function addTransaction(
  _prev: EntryState,
  formData: FormData
): Promise<EntryState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const input = parseTransactionForm(formData)
  const validationError = validateTransaction(input)
  if (validationError) return { ok: false, message: validationError }

  // fecha: input date (YYYY-MM-DD) anclado a mediodía Colombia; si vacío, ahora.
  const occurred_at = dateToOccurredAt(input.dateStr)

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: input.type,
    amount: input.amount,
    occurred_at,
    account_id: input.account_id,
    to_account_id: input.type === 'transfer' ? input.rawTo : null,
    category_id: input.type === 'transfer' ? null : input.rawCat || null,
    note: input.note,
    source: 'manual',
  })

  if (error) return { ok: false, message: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  revalidatePath('/cuentas')
  return { ok: true, message: 'Movimiento registrado.' }
}

/** Actualiza un movimiento existente del usuario autenticado. */
export async function updateTransaction(
  _prev: EntryState,
  formData: FormData
): Promise<EntryState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') || '')
  if (!id) return { ok: false, message: 'Movimiento inválido.' }

  const input = parseTransactionForm(formData)
  const validationError = validateTransaction(input)
  if (validationError) return { ok: false, message: validationError }

  const { error } = await supabase
    .from('transactions')
    .update({
      type: input.type,
      amount: input.amount,
      occurred_at: dateToOccurredAt(input.dateStr),
      account_id: input.account_id,
      to_account_id: input.type === 'transfer' ? input.rawTo : null,
      category_id: input.type === 'transfer' ? null : input.rawCat || null,
      note: input.note,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  revalidatePath('/cuentas')
  return { ok: true, message: 'Movimiento actualizado.' }
}

/** Elimina un movimiento del usuario autenticado. */
export async function deleteTransaction(
  _prev: EntryState,
  formData: FormData
): Promise<EntryState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') || '')
  if (!id) return { ok: false, message: 'Movimiento inválido.' }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  revalidatePath('/cuentas')
  return { ok: true, message: 'Movimiento eliminado.' }
}

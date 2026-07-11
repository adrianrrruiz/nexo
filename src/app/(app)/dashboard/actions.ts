'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TransactionType } from '@/lib/supabase/types'

export type EntryState = { ok: boolean; message: string } | null

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

  const type = String(formData.get('type')) as TransactionType
  const amount = Number(formData.get('amount'))
  const account_id = String(formData.get('account_id') || '')
  const rawTo = String(formData.get('to_account_id') || '')
  const rawCat = String(formData.get('category_id') || '')
  const dateStr = String(formData.get('date') || '')
  const note = String(formData.get('note') || '').trim() || null

  if (!amount || amount <= 0) return { ok: false, message: 'Monto inválido.' }
  if (!account_id) return { ok: false, message: 'Elige una cuenta.' }
  if (type === 'transfer' && !rawTo)
    return { ok: false, message: 'Elige la cuenta destino.' }
  if (type === 'transfer' && rawTo === account_id)
    return { ok: false, message: 'Las cuentas deben ser distintas.' }

  // fecha: input date (YYYY-MM-DD) anclado a mediodía Colombia; si vacío, ahora.
  const occurred_at = dateStr
    ? new Date(`${dateStr}T12:00:00-05:00`).toISOString()
    : new Date().toISOString()

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type,
    amount,
    occurred_at,
    account_id,
    to_account_id: type === 'transfer' ? rawTo : null,
    category_id: type === 'transfer' ? null : rawCat || null,
    note,
    source: 'manual',
  })

  if (error) return { ok: false, message: error.message }

  revalidatePath('/dashboard')
  return { ok: true, message: 'Movimiento registrado.' }
}

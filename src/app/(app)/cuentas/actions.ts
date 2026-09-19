'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatDateInputValue } from '@/lib/format'
import type { AccountType } from '@/lib/supabase/types'
import {
  getDefaultAccountImagePath,
  isDefaultAccountImage,
  isSupportedBank,
} from '@/lib/banks'

export type AccountState = { ok: boolean; message: string } | null

function parseAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').replace(/[^\d,-]/g, '').replace(',', '.')
  return Number(raw || 0)
}

async function getUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

export async function createAccount(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  void _prev
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const name = String(formData.get('name') ?? '').trim()
  const type = String(formData.get('type') ?? 'debit') as AccountType
  const bank = String(formData.get('bank') ?? '')
  const initial_balance = parseAmount(formData.get('initial_balance'))
  const credit_limit =
    type === 'credit' ? parseAmount(formData.get('credit_limit')) || null : null

  if (!name) return { ok: false, message: 'Escribe el nombre de la cuenta.' }
  if (!isSupportedBank(bank)) {
    return { ok: false, message: 'Selecciona un banco compatible.' }
  }

  const { error } = await supabase.from('accounts').insert({
    user_id: userId,
    name,
    type,
    bank,
    image_path: getDefaultAccountImagePath(bank, type),
    initial_balance,
    credit_limit,
  })

  if (error) return { ok: false, message: error.message }
  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Cuenta creada.' }
}

export async function updateAccount(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  void _prev
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const type = String(formData.get('type') ?? 'debit') as AccountType
  const bank = String(formData.get('bank') ?? '')
  const credit_limit =
    type === 'credit' ? parseAmount(formData.get('credit_limit')) || null : null

  if (!id) return { ok: false, message: 'Cuenta inválida.' }
  if (!name) return { ok: false, message: 'Escribe el nombre de la cuenta.' }
  if (!isSupportedBank(bank)) {
    return { ok: false, message: 'Selecciona un banco compatible.' }
  }

  const { data: currentAccount, error: lookupError } = await supabase
    .from('accounts')
    .select('image_path')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError || !currentAccount) {
    return { ok: false, message: 'No se pudo consultar la cuenta.' }
  }

  const image_path =
    !currentAccount.image_path || isDefaultAccountImage(currentAccount.image_path)
      ? getDefaultAccountImagePath(bank, type)
      : currentAccount.image_path

  const { error } = await supabase
    .from('accounts')
    .update({ name, type, bank, credit_limit, image_path })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }
  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Cuenta actualizada.' }
}

export async function archiveAccount(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  void _prev
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Cuenta inválida.' }

  const { error } = await supabase
    .from('accounts')
    .update({ archived: true })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }
  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Cuenta archivada.' }
}

export async function updateAccountReconciliation(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  void _prev
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Cuenta inválida.' }

  const clear = formData.get('clear') === '1'
  const date = clear ? '' : String(formData.get('reconciled_through') ?? '').trim()
  const note = clear ? '' : String(formData.get('reconciliation_note') ?? '').trim()

  if (note.length > 1000) {
    return { ok: false, message: 'La nota no puede superar 1000 caracteres.' }
  }
  if (!date && note) {
    return { ok: false, message: 'Elige una fecha para guardar la nota de conciliación.' }
  }
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, message: 'La fecha de conciliación no es válida.' }
    }
    const parsed = new Date(`${date}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      return { ok: false, message: 'La fecha de conciliación no es válida.' }
    }
    if (date > formatDateInputValue(new Date())) {
      return { ok: false, message: 'No puedes conciliar una fecha futura.' }
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .update({
      reconciled_through: date || null,
      reconciliation_note: note || null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, message: 'No se pudo guardar la conciliación.' }
  }
  revalidatePath('/cuentas')
  revalidatePath('/movimientos')
  return { ok: true, message: clear ? 'Conciliación quitada.' : 'Conciliación guardada.' }
}

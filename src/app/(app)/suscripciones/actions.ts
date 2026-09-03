'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { advanceChargeDate, isSubscriptionFrequency } from '@/lib/subscriptions'
import type { SubscriptionFrequency } from '@/lib/supabase/types'

export type SubscriptionState = { ok: boolean; message: string } | null

async function getUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

function revalidate() {
  revalidatePath('/suscripciones')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  revalidatePath('/cuentas')
}

function parseAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')
  return Number(raw || 0)
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseSubscriptionForm(formData: FormData) {
  const rawFrequency = String(formData.get('frequency') ?? 'monthly')
  return {
    name: String(formData.get('name') ?? '').trim(),
    amount: parseAmount(formData.get('amount')),
    account_id: String(formData.get('account_id') ?? ''),
    category_id: String(formData.get('category_id') ?? '') || null,
    frequency: (isSubscriptionFrequency(rawFrequency)
      ? rawFrequency
      : 'monthly') as SubscriptionFrequency,
    next_charge_on: String(formData.get('next_charge_on') ?? ''),
    note: String(formData.get('note') ?? '').trim() || null,
  }
}

function validate(input: ReturnType<typeof parseSubscriptionForm>) {
  if (!input.name) return 'Escribe el nombre de la suscripción.'
  if (input.name.length > 80) return 'El nombre es demasiado largo.'
  if (!input.amount || input.amount <= 0) return 'Monto inválido.'
  if (!input.account_id) return 'Elige la cuenta de cobro.'
  if (!DATE_PATTERN.test(input.next_charge_on)) return 'Fecha inválida.'
  return null
}

export async function createSubscription(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const input = parseSubscriptionForm(formData)
  const validationError = validate(input)
  if (validationError) return { ok: false, message: validationError }

  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    name: input.name,
    amount: input.amount,
    account_id: input.account_id,
    category_id: input.category_id,
    frequency: input.frequency,
    // el primer cobro ancla el día del mes de los siguientes
    started_on: input.next_charge_on,
    next_charge_on: input.next_charge_on,
    note: input.note,
  })

  if (error) {
    return {
      ok: false,
      message: error.code === '23505' ? 'Ya tienes una suscripción con ese nombre.' : error.message,
    }
  }

  revalidate()
  return { ok: true, message: 'Suscripción creada.' }
}

export async function updateSubscription(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Suscripción inválida.' }

  const input = parseSubscriptionForm(formData)
  const validationError = validate(input)
  if (validationError) return { ok: false, message: validationError }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      name: input.name,
      amount: input.amount,
      account_id: input.account_id,
      category_id: input.category_id,
      frequency: input.frequency,
      started_on: input.next_charge_on,
      next_charge_on: input.next_charge_on,
      note: input.note,
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return {
      ok: false,
      message: error.code === '23505' ? 'Ya tienes una suscripción con ese nombre.' : error.message,
    }
  }

  revalidate()
  return { ok: true, message: 'Suscripción actualizada.' }
}

export async function deleteSubscription(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Suscripción inválida.' }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }

  revalidate()
  return { ok: true, message: 'Suscripción eliminada.' }
}

/** Pausa o reactiva los recordatorios sin borrar el historial. */
export async function toggleSubscription(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Suscripción inválida.' }

  const { data: subscription, error: lookupError } = await supabase
    .from('subscriptions')
    .select('active')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message }
  if (!subscription) return { ok: false, message: 'Suscripción no encontrada.' }

  const { error } = await supabase
    .from('subscriptions')
    .update({ active: !subscription.active })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }

  revalidate()
  return {
    ok: true,
    message: subscription.active ? 'Suscripción pausada.' : 'Suscripción reactivada.',
  }
}

/**
 * Registra el cobro pendiente como gasto y adelanta la suscripción al siguiente
 * periodo. Solo avanza un periodo por confirmación: si venía atrasada, vuelve a
 * aparecer como pendiente para registrar cada cobro que faltó.
 */
export async function confirmSubscriptionCharge(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Suscripción inválida.' }

  // El cliente solo envía el id; el resto se relee de la fila del usuario.
  const { data: subscription, error: lookupError } = await supabase
    .from('subscriptions')
    .select('id,name,amount,account_id,category_id,frequency,started_on,next_charge_on,note')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message }
  if (!subscription) return { ok: false, message: 'Suscripción no encontrada.' }

  const chargedOn = subscription.next_charge_on
  const occurred_at = new Date(`${chargedOn}T12:00:00-05:00`).toISOString()

  const { error: transactionError } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'expense',
    amount: Number(subscription.amount),
    occurred_at,
    account_id: subscription.account_id,
    category_id: subscription.category_id,
    note: subscription.note ? `${subscription.name} · ${subscription.note}` : subscription.name,
    source: 'subscription',
    subscription_id: subscription.id,
  })

  if (transactionError) return { ok: false, message: transactionError.message }

  const { error: advanceError } = await supabase
    .from('subscriptions')
    .update({
      last_charged_on: chargedOn,
      next_charge_on: advanceChargeDate(
        chargedOn,
        subscription.frequency,
        subscription.started_on
      ),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (advanceError) {
    return {
      ok: false,
      message: 'Se registró el movimiento, pero no se pudo actualizar la fecha.',
    }
  }

  revalidate()
  return { ok: true, message: `${subscription.name} registrada.` }
}

/** Salta el cobro pendiente: no crea movimiento, solo pasa al siguiente periodo. */
export async function skipSubscriptionCharge(
  _prev: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Suscripción inválida.' }

  const { data: subscription, error: lookupError } = await supabase
    .from('subscriptions')
    .select('frequency,started_on,next_charge_on')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message }
  if (!subscription) return { ok: false, message: 'Suscripción no encontrada.' }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      next_charge_on: advanceChargeDate(
        subscription.next_charge_on,
        subscription.frequency,
        subscription.started_on
      ),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }

  revalidate()
  return { ok: true, message: 'Cobro omitido.' }
}

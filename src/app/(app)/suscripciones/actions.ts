'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSubscriptionFrequency } from '@/lib/subscriptions'
import { parseAccountAmount } from '@/lib/account-amounts'
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseSubscriptionForm(formData: FormData) {
  const rawFrequency = String(formData.get('frequency') ?? 'monthly')
  return {
    name: String(formData.get('name') ?? '').trim(),
    amount: parseAccountAmount(String(formData.get('amount') ?? '')),
    kind: String(formData.get('kind') ?? 'subscription'),
    account_id: String(formData.get('account_id') ?? '') || null,
    category_id: String(formData.get('category_id') ?? '') || null,
    frequency: rawFrequency as SubscriptionFrequency,
    next_charge_on: String(formData.get('next_charge_on') ?? ''),
    next_charge_until: String(formData.get('next_charge_until') ?? '') || null,
    note: String(formData.get('note') ?? '').trim() || null,
  }
}

function validate(input: ReturnType<typeof parseSubscriptionForm>) {
  if (!input.name) return 'Escribe el nombre de la suscripción.'
  if (input.name.length > 80) return 'El nombre es demasiado largo.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Escribe un monto válido, mayor que cero.'
  if (!['subscription', 'service'].includes(input.kind)) return 'Tipo de cobro inválido.'
  if (!isSubscriptionFrequency(input.frequency)) return 'Periodicidad inválida.'
  if (input.kind === 'subscription' && !input.account_id) return 'Elige la cuenta de cobro.'
  if (!isValidDate(input.next_charge_on)) return 'Elige una fecha válida.'
  if (input.kind === 'service' && (!input.next_charge_until || !isValidDate(input.next_charge_until) || input.next_charge_until < input.next_charge_on)) return 'El final del rango debe ser igual o posterior al inicio.'
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
    kind: input.kind as 'subscription' | 'service',
    name: input.name,
    amount: input.amount,
    account_id: input.account_id,
    category_id: input.category_id,
    frequency: input.frequency,
    // el primer cobro ancla el día del mes de los siguientes
    started_on: input.next_charge_on,
    next_charge_on: input.next_charge_on,
    started_until: input.kind === 'service' ? input.next_charge_until : null,
    next_charge_until: input.kind === 'service' ? input.next_charge_until : null,
    note: input.note,
  })

  if (error) {
    return {
      ok: false,
      message: error.code === '23505' ? 'Ya tienes una suscripción con ese nombre.' : error.message,
    }
  }

  revalidate()
  return { ok: true, message: input.kind === 'service' ? 'Servicio creado.' : 'Suscripción creada.' }
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
      kind: input.kind as 'subscription' | 'service',
      name: input.name,
      amount: input.amount,
      account_id: input.account_id,
      category_id: input.category_id,
      frequency: input.frequency,
      started_on: input.next_charge_on,
      next_charge_on: input.next_charge_on,
      started_until: input.kind === 'service' ? input.next_charge_until : null,
      next_charge_until: input.kind === 'service' ? input.next_charge_until : null,
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
  return { ok: true, message: input.kind === 'service' ? 'Servicio actualizado.' : 'Suscripción actualizada.' }
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

/** Confirming and dismissing reminders are atomic, scoped to the logged-in user. */
async function processCharge(formData: FormData, skip: boolean): Promise<SubscriptionState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }
  const id = String(formData.get('id') ?? '')
  const expected = String(formData.get('expected_charge_on') ?? '')
  if (!id || !isValidDate(expected)) return { ok: false, message: 'Recordatorio inválido. Recarga la página.' }
  const args: { p_subscription_id: string; p_expected_charge_on: string; p_skip: boolean; p_amount?: number; p_account_id?: string; p_charged_on?: string } = {
    p_subscription_id: id, p_expected_charge_on: expected, p_skip: skip,
  }
  if (!skip) {
    if (formData.has('amount')) {
      const amount = parseAccountAmount(String(formData.get('amount') ?? ''))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Escribe un monto válido.' }
      args.p_amount = amount
    }
    if (formData.has('account_id')) {
      const accountId = String(formData.get('account_id') ?? '')
      if (!accountId) return { ok: false, message: 'Elige la cuenta desde la que pagaste.' }
      args.p_account_id = accountId
    }
    if (formData.has('charged_on')) {
      const date = String(formData.get('charged_on') ?? '')
      if (!isValidDate(date)) return { ok: false, message: 'Elige una fecha válida.' }
      args.p_charged_on = date
    }
  }
  const { error } = await supabase.rpc('process_recurring_charge', args)
  if (error) return { ok: false, message: error.message }
  revalidate()
  return { ok: true, message: skip ? 'Recordatorio cerrado para este período.' : 'Gasto registrado.' }
}

export async function confirmSubscriptionCharge(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  return processCharge(formData, false)
}

export async function skipSubscriptionCharge(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  return processCharge(formData, true)
}

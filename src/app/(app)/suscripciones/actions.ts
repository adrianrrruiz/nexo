'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSuscripcionesActions } from '@nexo/shared/actions/suscripciones'
export type SubscriptionState = { ok: boolean; message: string } | null
export async function createSubscription(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).createSubscription(_prev, formData)
}
export async function updateSubscription(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).updateSubscription(_prev, formData)
}
export async function deleteSubscription(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).deleteSubscription(_prev, formData)
}
export async function toggleSubscription(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).toggleSubscription(_prev, formData)
}
export async function confirmSubscriptionCharge(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).confirmSubscriptionCharge(_prev, formData)
}
export async function skipSubscriptionCharge(_prev: SubscriptionState, formData: FormData) {
  return createSuscripcionesActions({ createClient, revalidatePath }).skipSubscriptionCharge(_prev, formData)
}
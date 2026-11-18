'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createDashboardActions } from '@nexo/shared/actions/dashboard'
export type EntryState = { ok: boolean; message: string } | null
export async function addTransaction(_prev: EntryState, formData: FormData) {
  return createDashboardActions({ createClient, revalidatePath }).addTransaction(_prev, formData)
}
export async function updateTransaction(_prev: EntryState, formData: FormData) {
  return createDashboardActions({ createClient, revalidatePath }).updateTransaction(_prev, formData)
}
export async function deleteTransaction(_prev: EntryState, formData: FormData) {
  return createDashboardActions({ createClient, revalidatePath }).deleteTransaction(_prev, formData)
}
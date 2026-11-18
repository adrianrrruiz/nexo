'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createCuentasActions } from '@nexo/shared/actions/cuentas'
export type AccountState = { ok: boolean; message: string } | null
export async function createAccount(_prev: AccountState, formData: FormData) {
  return createCuentasActions({ createClient, revalidatePath }).createAccount(_prev, formData)
}
export async function updateAccount(_prev: AccountState, formData: FormData) {
  return createCuentasActions({ createClient, revalidatePath }).updateAccount(_prev, formData)
}
export async function archiveAccount(_prev: AccountState, formData: FormData) {
  return createCuentasActions({ createClient, revalidatePath }).archiveAccount(_prev, formData)
}
export async function updateAccountReconciliation(_prev: AccountState, formData: FormData) {
  return createCuentasActions({ createClient, revalidatePath }).updateAccountReconciliation(_prev, formData)
}
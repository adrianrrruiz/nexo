'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { ok: boolean; message: string; email?: string } | null

function safeRedirectPath(value: FormDataEntryValue | null) {
  const candidate = String(value ?? '').trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/dashboard'

  try {
    const parsed = new URL(candidate, 'https://nexo.local')
    if (parsed.origin !== 'https://nexo.local') return '/dashboard'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/dashboard'
  }
}

/** Paso 1: envía un código de un solo uso (OTP) al correo. */
export async function requestOtp(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email) return { ok: false, message: 'Escribe tu correo.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })

  if (error) return { ok: false, message: 'Este correo no está autorizado.', email }
  return { ok: true, message: 'Te enviamos un código. Revisa tu correo.', email }
}

/** Paso 2: verifica el código y crea la sesión. */
export async function verifyOtp(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const token = String(formData.get('token') ?? '').trim()
  if (!email) return { ok: false, message: 'Falta el correo.' }
  if (!token) return { ok: false, message: 'Escribe el código.', email }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error)
    return { ok: false, message: 'Código inválido o expirado.', email }

  redirect(safeRedirectPath(formData.get('redirect')))
}

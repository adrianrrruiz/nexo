'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { ok: boolean; message: string } | null

/** Envía un enlace mágico (magic link) al correo. */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return { ok: false, message: 'Escribe tu correo.' }

  const origin = (await headers()).get('origin') ?? ''
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Te enviamos un enlace. Revisa tu correo.' }
}

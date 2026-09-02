'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hashShortcutToken } from '@/lib/shortcuts/auth'

export type ProfileState = { ok: boolean; message: string } | null
export type ShortcutTokenState =
  | { ok: boolean; message: string; token?: string }
  | null

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const fullName = String(formData.get('full_name') ?? '').trim() || null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const { error } = profile
    ? await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)
    : await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
      })

  if (error) return { ok: false, message: error.message }
  revalidatePath('/perfil')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Perfil actualizado.' }
}

export async function generateShortcutToken(
  _prev: ShortcutTokenState,
  _formData: FormData
): Promise<ShortcutTokenState> {
  void _prev
  void _formData
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const rawToken = `nexo_sk_${randomBytes(32).toString('base64url')}`
  const now = new Date().toISOString()
  const { error: revokeError } = await supabase
    .from('shortcut_tokens')
    .update({ revoked_at: now })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (revokeError) return { ok: false, message: 'No se pudo reemplazar la credencial.' }

  const { error } = await supabase.from('shortcut_tokens').insert({
    user_id: user.id,
    name: 'iPhone',
    token_hash: hashShortcutToken(rawToken),
  })

  if (error) return { ok: false, message: 'No se pudo crear la credencial.' }

  revalidatePath('/perfil')
  return {
    ok: true,
    message: 'Credencial creada. Cópiala ahora: Nexo no volverá a mostrarla.',
    token: rawToken,
  }
}

export async function revokeShortcutToken(
  _prev: ShortcutTokenState,
  _formData: FormData
): Promise<ShortcutTokenState> {
  void _prev
  void _formData
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada.' }

  const { error } = await supabase
    .from('shortcut_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (error) return { ok: false, message: 'No se pudo revocar la credencial.' }

  revalidatePath('/perfil')
  return { ok: true, message: 'Credencial revocada.' }
}

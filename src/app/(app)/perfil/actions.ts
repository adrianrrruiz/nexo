'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = { ok: boolean; message: string } | null

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

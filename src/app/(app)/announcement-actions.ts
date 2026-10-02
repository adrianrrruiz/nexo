'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_ANNOUNCEMENT_KEY } from '@/lib/announcements'

export async function dismissCategoryAnnouncement(): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión expirada. Vuelve a entrar.' }
  const { error } = await supabase.auth.updateUser({ data: { [CATEGORY_ANNOUNCEMENT_KEY]: true } })
  if (error) return { ok: false, message: 'No pudimos cerrar el anuncio. Intenta de nuevo.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

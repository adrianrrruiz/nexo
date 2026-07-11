'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CategoryKind } from '@/lib/supabase/types'

export type CategoryState = { ok: boolean; message: string } | null

async function getUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

export async function createCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const name = String(formData.get('name') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'expense') as CategoryKind
  const parent_id = String(formData.get('parent_id') ?? '') || null

  if (!name) return { ok: false, message: 'Escribe el nombre.' }

  const { error } = await supabase.from('categories').insert({
    user_id: userId,
    name,
    kind,
    parent_id,
  })

  if (error) return { ok: false, message: error.message }
  revalidatePath('/categorias')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Categoría creada.' }
}

export async function updateCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'expense') as CategoryKind
  const parent_id = String(formData.get('parent_id') ?? '') || null

  if (!id) return { ok: false, message: 'Categoría inválida.' }
  if (!name) return { ok: false, message: 'Escribe el nombre.' }
  if (parent_id === id) return { ok: false, message: 'No puede depender de sí misma.' }

  const { error } = await supabase
    .from('categories')
    .update({ name, kind, parent_id })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: error.message }
  revalidatePath('/categorias')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Categoría actualizada.' }
}

export async function deleteCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Categoría inválida.' }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, message: 'No se pudo eliminar. Revisa si tiene movimientos.' }
  revalidatePath('/categorias')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  return { ok: true, message: 'Categoría eliminada.' }
}

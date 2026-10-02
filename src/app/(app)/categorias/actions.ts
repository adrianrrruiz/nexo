'use server'

import { DEFAULT_CATEGORY_SUGGESTIONS } from '@/lib/category-suggestions'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CategoryKind } from '@/lib/supabase/types'

export type CategoryState = { ok: boolean; message: string } | null

export async function createSelectedCategories(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const { supabase, userId } = await getUserId()
  if (!userId) return { ok: false, message: 'Sesión expirada.' }
  const ids = [...new Set(formData.getAll('suggestion_id').map(String))]
  const builtIn = DEFAULT_CATEGORY_SUGGESTIONS.filter((item) => ids.includes(item.id))
  const remoteIds = ids.filter((id) => !builtIn.some((item) => item.id === id))
  if (!ids.length || ids.length > 100 || remoteIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return { ok: false, message: 'Elige al menos una categoría sugerida.' }
  }
  const [suggestions, existing] = await Promise.all([
    remoteIds.length
      ? supabase.from('categories').select('id,name,kind,color,icon')
          .in('id', remoteIds).eq('is_suggested', true).is('parent_id', null)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('categories').select('name,kind')
      .eq('user_id', userId).eq('is_suggested', false).is('parent_id', null),
  ])
  if (suggestions.error || existing.error) {
    return { ok: false, message: 'No pudimos cargar las categorías. Intenta de nuevo.' }
  }
  const resolved = [...builtIn, ...(suggestions.data ?? [])]
  if (resolved.length !== ids.length) {
    return { ok: false, message: 'Una sugerencia ya no está disponible. Actualiza la página.' }
  }
  const names = new Set((existing.data ?? []).map((item) => `${item.kind}:${item.name.trim().toLocaleLowerCase('es')}`))
  const rows = resolved.filter((item) => {
    const key = `${item.kind}:${item.name.trim().toLocaleLowerCase('es')}`
    if (names.has(key)) return false
    names.add(key)
    return true
  }).map(({ name, kind, color, icon }) => ({
    user_id: userId, name, kind, color, icon, parent_id: null, is_suggested: false,
  }))
  if (rows.length) {
    const { error } = await supabase.from('categories').insert(rows)
    if (error) return { ok: false, message: 'No pudimos guardar las categorías. Intenta de nuevo.' }
  }
  revalidatePath('/categorias')
  revalidatePath('/dashboard')
  revalidatePath('/movimientos')
  revalidatePath('/suscripciones')
  return { ok: true, message: rows.length ? `${rows.length} ${rows.length === 1 ? 'categoría agregada' : 'categorías agregadas'}. Ya puedes usarlas en tus movimientos.` : 'Estas categorías ya están en tu lista.' }
}

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

export async function createCategoryFromSuggestion(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  return createSelectedCategories(_prev, formData)
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

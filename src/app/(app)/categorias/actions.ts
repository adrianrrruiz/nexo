'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createCategoriasActions } from '@nexo/shared/actions/categorias'
export type CategoryState = { ok: boolean; message: string } | null
export async function createSelectedCategories(_prev: CategoryState, formData: FormData) {
  return createCategoriasActions({ createClient, revalidatePath }).createSelectedCategories(_prev, formData)
}
export async function createCategory(_prev: CategoryState, formData: FormData) {
  return createCategoriasActions({ createClient, revalidatePath }).createCategory(_prev, formData)
}
export async function createCategoryFromSuggestion(_prev: CategoryState, formData: FormData) {
  return createCategoriasActions({ createClient, revalidatePath }).createCategoryFromSuggestion(_prev, formData)
}
export async function updateCategory(_prev: CategoryState, formData: FormData) {
  return createCategoriasActions({ createClient, revalidatePath }).updateCategory(_prev, formData)
}
export async function deleteCategory(_prev: CategoryState, formData: FormData) {
  return createCategoriasActions({ createClient, revalidatePath }).deleteCategory(_prev, formData)
}
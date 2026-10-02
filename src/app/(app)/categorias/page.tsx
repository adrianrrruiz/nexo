import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEFAULT_CATEGORY_SUGGESTIONS } from '@/lib/category-suggestions'
import CategoryWorkspace from '@/components/CategoryWorkspace'
import type { Category } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [categoriesRes, suggestionsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_suggested', false)
      .order('kind')
      .order('name'),
    supabase
      .from('categories')
      .select('id,name,kind,color,icon')
      .eq('is_suggested', true)
      .is('parent_id', null)
      .order('kind')
      .order('name'),
  ])

  const queryError = categoriesRes.error ?? suggestionsRes.error
  if (queryError) {
    throw new Error(`No se pudieron cargar las categorías: ${queryError.message}`)
  }

  const categories = (categoriesRes.data ?? []) as Category[]
  const suggestions = (suggestionsRes.data ?? []) as Pick<
    Category,
    'id' | 'name' | 'kind' | 'color' | 'icon'
  >[]
  return <CategoryWorkspace categories={categories} suggestions={suggestions.length ? suggestions : DEFAULT_CATEGORY_SUGGESTIONS} />
}

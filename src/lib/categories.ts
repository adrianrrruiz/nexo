import type { Category } from '@/lib/supabase/types'

type CategoryLite = Pick<Category, 'id' | 'name' | 'parent_id'>

export function categoryLabel(
  categoryId: string | null,
  categoryName: Map<string, string>,
  categoryParent: Map<string, string | null>,
  fallback: string
) {
  if (!categoryId) return fallback
  const name = categoryName.get(categoryId) ?? fallback
  const parentId = categoryParent.get(categoryId)
  const parentName = parentId ? categoryName.get(parentId) : null
  return parentName ? `${parentName} / ${name}` : name
}

export function categoryGroupKey(
  categoryId: string | null,
  categoryName: Map<string, string>,
  categoryParent: Map<string, string | null>
) {
  if (!categoryId) return 'Sin categoría'
  const parentId = categoryParent.get(categoryId)
  return parentId
    ? categoryName.get(parentId) ?? 'Sin categoría'
    : categoryName.get(categoryId) ?? 'Sin categoría'
}

export function sortCategoriesForSelect(categories: CategoryLite[]) {
  const childrenByParent = new Map<string, CategoryLite[]>()
  const parents = categories.filter((category) => !category.parent_id)

  for (const category of categories) {
    if (!category.parent_id) continue
    const list = childrenByParent.get(category.parent_id)
    if (list) list.push(category)
    else childrenByParent.set(category.parent_id, [category])
  }

  return parents
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .flatMap((parent) => [
      parent,
      ...(childrenByParent.get(parent.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, 'es')
      ),
    ])
}

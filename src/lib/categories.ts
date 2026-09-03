import type { Category } from '@/lib/supabase/types'

type CategoryLite = Pick<Category, 'id' | 'name' | 'parent_id'>

/** Valor en la URL y etiqueta para movimientos sin categoría. */
export const UNCATEGORIZED_KEY = 'sin'
export const UNCATEGORIZED_LABEL = 'Sin categoría'

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
  if (!categoryId) return UNCATEGORIZED_LABEL
  const parentId = categoryParent.get(categoryId)
  return parentId
    ? categoryName.get(parentId) ?? UNCATEGORIZED_LABEL
    : categoryName.get(categoryId) ?? UNCATEGORIZED_LABEL
}

/**
 * Id del grupo (categoría de nivel superior) al que pertenece un movimiento:
 * su categoría padre si es subcategoría, o su propia categoría si es de nivel
 * superior. `null` cuando no tiene categoría. Sirve para agrupar y filtrar.
 */
export function categoryGroupId(
  categoryId: string | null,
  categoryParent: Map<string, string | null>
): string | null {
  if (!categoryId) return null
  return categoryParent.get(categoryId) ?? categoryId
}

/** Todos los ids de categoría que pertenecen a un grupo: el padre y sus hijas. */
export function categoryIdsInGroup(
  groupId: string,
  categories: Pick<Category, 'id' | 'parent_id'>[]
): string[] {
  return categories
    .filter((category) => category.id === groupId || category.parent_id === groupId)
    .map((category) => category.id)
}

export function sortCategoriesForSelect<T extends CategoryLite>(categories: T[]): T[] {
  const childrenByParent = new Map<string, T[]>()
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

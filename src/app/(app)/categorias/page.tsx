import { createClient } from '@/lib/supabase/server'
import { EditCategoryButton, NewCategoryButton } from '@/components/CategoryManager'
import type { Category, CategoryKind } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: 'Gastos',
  income: 'Ingresos',
}

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('kind')
    .order('name')

  const categories = (data ?? []) as Category[]
  const byKind = new Map<CategoryKind, Category[]>()
  for (const category of categories) {
    const list = byKind.get(category.kind)
    if (list) list.push(category)
    else byKind.set(category.kind, [category])
  }

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Categorías</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Organiza tus movimientos con subcategorías.
          </p>
        </div>
        <NewCategoryButton categories={categories} />
      </header>

      {categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-neutral-300">Aún no tienes categorías.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Crea las que uses para tus gastos e ingresos.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {(['expense', 'income'] as CategoryKind[]).map((kind) => {
            const items = byKind.get(kind) ?? []
            if (items.length === 0) return null
            const parents = items.filter((item) => !item.parent_id)
            const childrenByParent = new Map<string, Category[]>()
            for (const item of items) {
              if (!item.parent_id) continue
              const list = childrenByParent.get(item.parent_id)
              if (list) list.push(item)
              else childrenByParent.set(item.parent_id, [item])
            }

            return (
              <section key={kind}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {KIND_LABEL[kind]}
                </h2>
                <div className="space-y-3">
                  {parents.map((parent) => (
                    <div
                      key={parent.id}
                      className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{parent.name}</p>
                        <EditCategoryButton category={parent} categories={categories} />
                      </div>
                      {(childrenByParent.get(parent.id) ?? []).length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
                          {(childrenByParent.get(parent.id) ?? []).map((child) => (
                            <div key={child.id} className="flex items-center justify-between gap-3">
                              <p className="text-sm text-neutral-400">{child.name}</p>
                              <EditCategoryButton category={child} categories={categories} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {items
                    .filter((item) => item.parent_id && !parents.some((parent) => parent.id === item.parent_id))
                    .map((orphan) => (
                      <div
                        key={orphan.id}
                        className="flex items-center justify-between gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4"
                      >
                        <p className="text-sm font-medium">{orphan.name}</p>
                        <EditCategoryButton category={orphan} categories={categories} />
                      </div>
                    ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryState,
} from '@/app/(app)/categorias/actions'
import type { Category, CategoryKind } from '@/lib/supabase/types'

const FIELD =
  'w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-base outline-none focus:border-brand/60'

export function NewCategoryButton({ categories }: { categories: Category[] }) {
  return <CategoryForm mode="create" categories={categories} />
}

export function EditCategoryButton({
  category,
  categories,
}: {
  category: Category
  categories: Category[]
}) {
  return <CategoryForm mode="edit" category={category} categories={categories} />
}

function CategoryForm({
  mode,
  category,
  categories,
}: {
  mode: 'create' | 'edit'
  category?: Category
  categories: Category[]
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense')
  const [state, action, pending] = useActionState<CategoryState, FormData>(
    mode === 'create' ? createCategory : updateCategory,
    null
  )
  const [deleteState, deleteAction, deleting] = useActionState<CategoryState, FormData>(
    deleteCategory,
    null
  )

  useEffect(() => {
    if (state?.ok || deleteState?.ok) {
      const t = setTimeout(() => setOpen(false), 600)
      return () => clearTimeout(t)
    }
  }, [state, deleteState])

  const parentOptions = categories.filter(
    (item) => !item.parent_id && item.kind === kind && item.id !== category?.id
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setKind(category?.kind ?? 'expense')
          setOpen(true)
        }}
        className={
          mode === 'create'
            ? 'rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-950'
            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-400 transition-colors hover:text-brand'
        }
        aria-label={mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
      >
        {mode === 'create' ? (
          'Nueva'
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15.5 5.5 3 3M4 20l4.2-1 10.3-10.3a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[28px] border-t border-white/10 bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400"
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form action={action} className="space-y-3">
              {category && <input type="hidden" name="id" value={category.id} />}
              <input
                name="name"
                required
                defaultValue={category?.name ?? ''}
                placeholder="Nombre"
                className={FIELD}
              />
              <select
                name="kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as CategoryKind)}
                className={FIELD}
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
              <select name="parent_id" defaultValue={category?.parent_id ?? ''} className={FIELD}>
                <option value="">Categoría principal</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    Subcategoría de {item.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 disabled:opacity-60"
              >
                {pending ? 'Guardando...' : 'Guardar'}
              </button>
              {state && (
                <p className={`text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}>
                  {state.message}
                </p>
              )}
            </form>

            {category && (
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (!confirm('¿Eliminar esta categoría?')) event.preventDefault()
                }}
                className="mt-3"
              >
                <input type="hidden" name="id" value={category.id} />
                <button
                  type="submit"
                  disabled={deleting}
                  className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 disabled:opacity-60"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar categoría'}
                </button>
                {deleteState && !deleteState.ok && (
                  <p className="mt-2 text-center text-sm text-red-400">
                    {deleteState.message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

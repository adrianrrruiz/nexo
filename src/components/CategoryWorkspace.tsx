'use client'

import { useActionState, useState } from 'react'
import { createSelectedCategories, type CategoryState } from '@/app/(app)/categorias/actions'
import { EditCategoryButton, NewCategoryButton } from '@/components/CategoryManager'
import type { Category, CategoryKind } from '@/lib/supabase/types'

type Suggestion = Pick<Category, 'id' | 'name' | 'kind' | 'color' | 'icon'>

function CategoryIcon({ icon }: { icon: string | null }) {
  return icon ? <span aria-hidden="true" className="text-3xl">{icon}</span> : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M3 4h8l10 10-7 7L3 10V4Z" /><circle cx="7.5" cy="8" r="1" />
    </svg>
  )
}

export default function CategoryWorkspace({ categories, suggestions }: { categories: Category[]; suggestions: Suggestion[] }) {
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [view, setView] = useState<'mine' | 'add'>(categories.length ? 'mine' : 'add')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [state, action, pending] = useActionState<CategoryState, FormData>(createSelectedCategories, null)
  const existingNames = new Set(categories.filter((item) => !item.parent_id).map((item) => `${item.kind}:${item.name.trim().toLocaleLowerCase('es')}`))
  const available = suggestions.filter((item) => !existingNames.has(`${item.kind}:${item.name.trim().toLocaleLowerCase('es')}`))
  const selectedIds = available.filter((item) => selected.has(item.id)).map((item) => item.id)
  const items = categories.filter((item) => item.kind === kind)
  const roots = items.filter((item) => !item.parent_id || !items.some((parent) => parent.id === item.parent_id))
  const visible = available.filter((item) => item.kind === kind)

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">A tu manera</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tus categorías</h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-neutral-400">
          Elige las que usarás o crea las tuyas. Siempre puedes cambiarlas después.
        </p>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-white/[0.05] p-1" aria-label="Vista de categorías">
          <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')} className={`rounded-xl px-3 py-2.5 text-sm font-medium ${view === 'mine' ? 'bg-white/10 text-white' : 'text-neutral-400'}`}>Mis categorías ({categories.length})</button>
          <button type="button" aria-pressed={view === 'add'} onClick={() => setView('add')} className={`rounded-xl px-3 py-2.5 text-sm font-medium ${view === 'add' ? 'bg-white/10 text-white' : 'text-neutral-400'}`}>Añadir sugeridas</button>
        </div>
        <NewCategoryButton categories={categories} />
      </div>
      <section className="rounded-[28px] border border-white/[0.06] bg-surface/80 p-4 text-neutral-100 sm:p-7" aria-label={view === 'add' ? 'Elegir categorías sugeridas' : 'Gestionar tus categorías'}>
        <div className="mx-auto mb-5 grid max-w-xs grid-cols-2 rounded-full border border-white/[0.06] bg-white/[0.04] p-1.5" aria-label="Tipo de categoría">
          {(['expense', 'income'] as const).map((type) => (
            <button key={type} type="button" aria-pressed={kind === type} onClick={() => setKind(type)} className={`rounded-full py-3 text-sm font-semibold transition-colors ${kind === type ? 'bg-brand text-neutral-950 shadow-sm shadow-brand/10' : 'text-neutral-400'}`}>
              {type === 'expense' ? 'Gastos' : 'Ingresos'}
            </button>
          ))}
        </div>
        {view === 'add' ? (
          <form action={action}>
            {selectedIds.map((id) => <input key={id} type="hidden" name="suggestion_id" value={id} />)}
            <p className="mb-5 text-center text-sm leading-relaxed text-neutral-400">Toca las categorías que quieras añadir. Puedes elegir de ambos tipos.</p>
            {visible.length ? (
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                {visible.map((item) => {
                  const checked = selected.has(item.id)
                  return (
                    <button key={item.id} type="button" aria-pressed={checked} disabled={pending} onClick={() => setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })} className={`relative flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-[22px] border px-1 py-5 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:opacity-60 sm:min-h-40 ${checked ? 'border-brand/60 bg-brand/[0.10] ring-1 ring-brand/30' : 'border-white/[0.06] bg-white/[0.03] hover:border-brand/30 hover:bg-white/[0.05]'}`}>
                      <span aria-hidden="true" className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${checked ? 'bg-brand text-neutral-950' : 'border border-white/15 bg-white/[0.04] text-transparent'}`}>✓</span>
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/[0.08] text-brand ring-1 ring-brand/10 sm:h-20 sm:w-20"><CategoryIcon icon={item.icon} /></span>
                      <span className="w-full break-words text-[11px] font-semibold leading-snug sm:text-base">{item.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm leading-relaxed text-neutral-400">{suggestions.some((item) => item.kind === kind) ? 'Ya tienes todas las sugeridas de este tipo. Puedes crear una categoría propia.' : 'No hay sugerencias de este tipo por ahora. Crea una categoría propia para empezar.'}</p>
            )}
            <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 -mx-1 mt-6 rounded-2xl border border-white/[0.06] bg-surface/95 p-2 backdrop-blur lg:bottom-4">
              <button type="submit" disabled={pending || selectedIds.length === 0} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-deep px-4 py-4 text-base font-semibold text-neutral-950 shadow-lg shadow-brand/10 disabled:from-surface-2 disabled:to-surface-2 disabled:text-neutral-500 disabled:shadow-none">
                {pending ? 'Guardando categorías…' : selectedIds.length ? `Añadir ${selectedIds.length} ${selectedIds.length === 1 ? 'categoría' : 'categorías'}` : 'Elige tus categorías'}
                {selectedIds.length > 0 && <span aria-hidden="true">→</span>}
              </button>
              {state && <p role="status" className={`mt-3 text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}>{state.message}</p>}
              {state?.ok && (
                <button type="button" onClick={() => setView('mine')} className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-brand hover:bg-brand/10">
                  Ver mis categorías →
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            <p className="mb-5 text-center text-sm text-neutral-400">Edita el nombre o agrupa tus movimientos con subcategorías.</p>
            {roots.length ? <div className="grid gap-3 sm:grid-cols-2">
              {roots.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/[0.08] text-brand"><CategoryIcon icon={item.icon} /></span>
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold">{item.name}</span>
                    <EditCategoryButton category={item} categories={categories} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    <span className="text-xs font-medium text-neutral-500">Subcategorías ({items.filter((child) => child.parent_id === item.id).length})</span>
                    <NewCategoryButton categories={categories} parentCategory={item} />
                  </div>
                  {items.filter((child) => child.parent_id === item.id).map((child) => (
                    <div key={child.id} className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pl-3 pt-3">
                      <span className="min-w-0 break-words text-sm">{child.name}</span><EditCategoryButton category={child} categories={categories} />
                    </div>
                  ))}
                </div>
              ))}
            </div> : <div className="py-8 text-center">
              <p className="font-semibold">Aún no tienes categorías de {kind === 'expense' ? 'gastos' : 'ingresos'}.</p>
              <p className="mt-2 text-sm text-neutral-400">Empieza con las sugeridas o crea una con tu propio nombre.</p>
              <button type="button" onClick={() => setView('add')} className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-neutral-950">Elegir sugeridas →</button>
            </div>}
          </>
        )}
      </section>
    </div>
  )
}

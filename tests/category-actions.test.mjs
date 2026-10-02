import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

function load(relativePath, imports = {}) {
  const exports = {}
  const source = ts.transpileModule(readFileSync(resolve(relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`)
    return imports[name]
  }, Set, Promise, String, setTimeout, clearTimeout })
  return exports
}
const catalog = load('src/lib/category-suggestions.ts')
const announcement = load('src/lib/announcements.ts')
function setup({ user = { id: 'current-user' }, existing = [], suggestions = [], insertError = null, updateError = null } = {}) {
  const queries = [], inserts = [], metadata = [], revalidated = []
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: async (value) => { metadata.push(value); return { error: updateError } },
    },
    from: (table) => {
      const operations = []
      queries.push({ table, operations })
      const query = {}
      for (const method of ['select', 'eq', 'is', 'in']) query[method] = (...args) => { operations.push([method, ...args]); return query }
      query.then = (fulfilled, rejected) => Promise.resolve({ data: operations.some(([method]) => method === 'in') ? suggestions : existing, error: null }).then(fulfilled, rejected)
      query.insert = async (rows) => { inserts.push(rows); return { error: insertError } }
      return query
    },
  }
  const imports = {
    '@/lib/supabase/server': { createClient: async () => supabase },
    'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
    '@/lib/category-suggestions': catalog,
    '@/lib/announcements': announcement,
  }
  return { ...load('src/app/(app)/categorias/actions.ts', imports), ...load('src/app/(app)/announcement-actions.ts', imports), queries, inserts, metadata, revalidated }
}
function selection(...ids) { const form = new FormData(); ids.forEach(id => form.append('suggestion_id', id)); return form }

test('an expired session cannot create categories or dismiss the announcement', async () => {
  const api = setup({ user: null })
  assert.equal((await api.createSelectedCategories(null, selection('starter-market'))).ok, false)
  assert.equal((await api.dismissCategoryAnnouncement()).ok, false)
  assert.equal(api.queries.length + api.metadata.length, 0)
})
test('empty and forged selections do not reach the database', async () => {
  for (const ids of [[], ['starter-made-up'], ['not-a-uuid']]) {
    const api = setup()
    assert.equal((await api.createSelectedCategories(null, selection(...ids))).ok, false)
    assert.equal(api.queries.length, 0)
  }
})
test('mixed expense and income selections are saved atomically for the authenticated user', async () => {
  const api = setup()
  assert.equal((await api.createSelectedCategories(null, selection('starter-market', 'starter-salary', 'starter-market'))).ok, true)
  assert.equal(api.inserts.length, 1)
  assert.deepEqual(Array.from(api.inserts[0], row => [row.name, row.kind, row.user_id, row.is_suggested]), [
    ['Mercado', 'expense', 'current-user', false], ['Salario', 'income', 'current-user', false],
  ])
  assert.ok(api.queries[0].operations.some(([method, column, value]) => method === 'eq' && column === 'user_id' && value === 'current-user'))
})
test('existing root names are compared regardless of case and surrounding whitespace', async () => {
  const api = setup({ existing: [{ name: ' mercado ', kind: 'expense' }] })
  await api.createSelectedCategories(null, selection('starter-market', 'starter-salary'))
  assert.equal(api.inserts[0].length, 1)
  assert.equal(api.inserts[0][0].name, 'Salario')
})
test('retrying an already saved selection succeeds without inserting duplicates', async () => {
  const api = setup({ existing: [{ name: 'Mercado', kind: 'expense' }] })
  assert.equal((await api.createSelectedCategories(null, selection('starter-market'))).ok, true)
  assert.equal(api.inserts.length, 0)
})
test('unknown database category ids cannot be copied as suggestions', async () => {
  const api = setup()
  assert.equal((await api.createSelectedCategories(null, selection('00000000-0000-4000-8000-000000000001'))).ok, false)
  assert.equal(api.inserts.length, 0)
  assert.ok(api.queries[0].operations.some(([method, column, value]) => method === 'eq' && column === 'is_suggested' && value === true))
})
test('a failed batch reports failure and does not revalidate as if saved', async () => {
  const api = setup({ insertError: { message: 'unavailable' } })
  assert.equal((await api.createSelectedCategories(null, selection('starter-market'))).ok, false)
  assert.equal(api.revalidated.length, 0)
})
test('the announcement dismissal saves only the current announcement preference', async () => {
  const api = setup()
  assert.equal((await api.dismissCategoryAnnouncement()).ok, true)
  assert.equal(api.metadata[0].data[announcement.CATEGORY_ANNOUNCEMENT_KEY], true)
  assert.equal(Object.keys(api.metadata[0].data).length, 1)
  const failure = setup({ updateError: { message: 'unavailable' } })
  assert.equal((await failure.dismissCategoryAnnouncement()).ok, false)
  assert.equal(failure.revalidated.length, 0)
})

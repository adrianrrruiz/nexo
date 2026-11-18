import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './load.mjs'
function fields(input) {
  const form = new FormData()
  for (const [key, value] of Object.entries(input)) form.set(key, value)
  return form
}
function setup(user = { id: 'owner' }) {
  const inserts = [],
    updates = [],
    conditions = []
  const query = {
    update: (value) => {
      updates.push(value)
      return query
    },
    eq: (...args) => {
      conditions.push(args)
      return query
    },
    then: (yes, no) => Promise.resolve({ error: null }).then(yes, no),
    insert: async (value) => {
      inserts.push(value)
      return { error: null }
    },
  }
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => query,
  }
  const actions = load('src/app/(app)/dashboard/actions.ts', {
    '@/lib/supabase/server': { createClient: () => client },
    'next/cache': { revalidatePath: () => {} },
  })
  return { ...actions, inserts, updates, conditions }
}
const values = (overrides) => ({
  type: 'expense',
  amount: '1234.56',
  account_id: 'account-a',
  date: '2026-10-13',
  category_id: 'category',
  ...overrides,
})
test('FormData preserves cents, account, owner and Bogota date', async () => {
  const api = setup()
  assert.equal((await api.addTransaction(null, fields(values({})))).ok, true)
  assert.equal(api.inserts[0].amount, 1234.56)
  assert.equal(api.inserts[0].user_id, 'owner')
  assert.equal(api.inserts[0].occurred_at, '2026-10-13T17:00:00.000Z')
})
test('invalid amounts, dates, types and same-account transfers never write', async () => {
  for (const input of [
    { amount: 'Infinity' },
    { amount: 'NaN' },
    { amount: '-1' },
    { date: '2026-02-30' },
    { date: 'bad' },
    { type: 'bad' },
    { type: 'transfer', to_account_id: 'account-a' },
  ]) {
    const api = setup()
    assert.equal(
      (await api.addTransaction(null, fields(values(input)))).ok,
      false,
    )
    assert.equal(api.inserts.length, 0)
  }
})
test('transfers retain destination and never write a category', async () => {
  const api = setup()
  assert.equal(
    (
      await api.addTransaction(
        null,
        fields(values({ type: 'transfer', to_account_id: 'account-b' })),
      )
    ).ok,
    true,
  )
  assert.equal(api.inserts[0].to_account_id, 'account-b')
  assert.equal(api.inserts[0].category_id, null)
})
test('updates are explicitly scoped to both record and authenticated owner', async () => {
  const api = setup()
  assert.equal(
    (await api.updateTransaction(null, fields(values({ id: 'transaction' }))))
      .ok,
    true,
  )
  assert.deepEqual(
    api.conditions.map((value) => Array.from(value)),
    [
      ['id', 'transaction'],
      ['user_id', 'owner'],
    ],
  )
  const expired = setup(null)
  assert.equal(
    (await expired.addTransaction(null, fields(values({})))).ok,
    false,
  )
  assert.equal(expired.inserts.length, 0)
})

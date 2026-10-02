import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path, imports = {}) {
  const exports = {}
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in imports, `Unexpected import: ${name}`); return imports[name] } })
  return exports
}
const format = load('src/lib/format.ts')
const recurring = load('src/lib/subscriptions.ts', { '@/lib/format': format })
const amounts = load('src/lib/account-amounts.ts')
function setup(user = { id: 'owner' }, rpcError = null) {
  const inserts = [], calls = [], refreshed = []
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ insert: async row => { inserts.push(row); return { error: null } } }), rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError } } }
  const actions = load('src/app/(app)/suscripciones/actions.ts', { '@/lib/supabase/server': { createClient: async () => client }, '@/lib/subscriptions': recurring, '@/lib/account-amounts': amounts, 'next/cache': { revalidatePath: path => refreshed.push(path) } })
  return { ...actions, inserts, calls, refreshed }
}
function form(overrides = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ kind: 'service', name: 'Energía', amount: '170000.50', frequency: 'monthly', next_charge_on: '2026-10-01', next_charge_until: '2026-10-05', account_id: '', ...overrides })) data.set(key, value)
  return data
}
test('services preserve cents, their payment window and an optional account', async () => {
  const api = setup()
  assert.equal((await api.createSubscription(null, form())).ok, true)
  assert.equal(api.inserts[0].account_id, null)
  assert.equal(api.inserts[0].user_id, 'owner')
  assert.equal(api.inserts[0].amount, 170000.5)
  assert.equal(api.inserts[0].started_until, '2026-10-05')
  assert.equal(api.inserts[0].next_charge_until, '2026-10-05')
})
test('subscriptions still require an account and have no payment window', async () => {
  const api = setup()
  assert.equal((await api.createSubscription(null, form({ kind: 'subscription' }))).ok, false)
  assert.equal((await api.createSubscription(null, form({ kind: 'subscription', account_id: 'account' }))).ok, true)
  assert.equal(api.inserts[0].next_charge_until, null)
})
test('invalid ranges, impossible dates, amounts and frequencies are rejected', async () => {
  for (const input of [{ next_charge_until: '2026-09-30' }, { next_charge_until: '' }, { next_charge_on: '2026-02-30' }, { amount: 'Infinity' }, { amount: 'abc' }, { amount: '-1' }, { frequency: 'toString' }, { frequency: 'daily' }, { kind: 'forged' }]) {
    const api = setup()
    assert.equal((await api.createSubscription(null, form(input))).ok, false)
    assert.equal(api.inserts.length, 0)
  }
})
test('confirm uses the atomic RPC with the real amount, account and occurrence', async () => {
  const api = setup()
  const data = form({ id: 'service', expected_charge_on: '2026-10-01', amount: '165000.75', account_id: 'my-account', charged_on: '2026-10-03' })
  assert.equal((await api.confirmSubscriptionCharge(null, data)).ok, true)
  assert.equal(api.calls[0].name, 'process_recurring_charge')
  assert.equal(api.calls[0].args.p_amount, 165000.75)
  assert.equal(api.calls[0].args.p_account_id, 'my-account')
  assert.equal(api.calls[0].args.p_expected_charge_on, '2026-10-01')
  assert.equal(api.calls[0].args.p_charged_on, '2026-10-03')
  assert.equal(api.inserts.length, 0)
})
test('closing a reminder requests skip without inserting a transaction', async () => {
  const api = setup()
  assert.equal((await api.skipSubscriptionCharge(null, form({ id: 'service', expected_charge_on: '2026-10-01' }))).ok, true)
  assert.equal(api.calls[0].args.p_skip, true)
  assert.equal(api.inserts.length, 0)
})
test('missing session, missing occurrence and incomplete actual payments do not reach RPC', async () => {
  const unauthenticated = setup(null)
  assert.equal((await unauthenticated.createSubscription(null, form())).ok, false)
  assert.equal((await unauthenticated.confirmSubscriptionCharge(null, form())).ok, false)
  for (const values of [{ expected_charge_on: '' }, { amount: '0' }, { account_id: '' }, { charged_on: '2026-02-30' }]) {
    const api = setup()
    assert.equal((await api.confirmSubscriptionCharge(null, form({ id: 'service', expected_charge_on: '2026-10-01', account_id: 'account', ...values }))).ok, false)
    assert.equal(api.calls.length, 0)
  }
})
test('RPC failures preserve the error and do not report success or refresh', async () => {
  const api = setup({ id: 'owner' }, { message: 'Este recordatorio ya se actualizó.' })
  assert.equal((await api.skipSubscriptionCharge(null, form({ id: 'service', expected_charge_on: '2026-10-01' }))).ok, false)
  assert.equal(api.refreshed.length, 0)
})
test('calendar anchors recover after short months and preserve weekly periods', () => {
  assert.equal(recurring.advanceChargeDate('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28')
  assert.equal(recurring.advanceChargeDate('2026-02-28', 'monthly', '2026-01-31'), '2026-03-31')
  assert.equal(recurring.advanceChargeDate('2026-10-01', 'weekly', '2026-10-01'), '2026-10-08')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}) {
  const exports = {}
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`)
    return imports[name]
  }, Number, String })
  return exports
}
const amounts = load('src/lib/account-amounts.ts')
const banks = load('src/lib/banks.ts')

test('normalized form amounts preserve cents, including negative credit balances', () => {
  for (const [input, expected] of [['1234.56', 1234.56], ['-1234.56', -1234.56], ['100.00', 100], ['0.00', 0], ['', 0]]) assert.equal(amounts.parseAccountAmount(input), expected)
})
test('Colombian currency and thousands separators remain supported', () => {
  for (const [input, expected] of [['$ 1.234,56', 1234.56], ['1.234', 1234], ['1.000.000,00', 1000000], ['-1.234,50', -1234.5], ['1250,50', 1250.5]]) assert.equal(amounts.parseAccountAmount(input), expected)
})
test('malformed amounts cannot silently become a different balance', () => {
  for (const input of ['abc', '1,2,3', '1.234.50', '--100', 'Infinity']) assert.ok(Number.isNaN(amounts.parseAccountAmount(input)))
})
function setup(user = { id: 'current-user' }) {
  const inserts = []
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ insert: async (row) => { inserts.push(row); return { error: null } } }) }
  const actions = load('src/app/(app)/cuentas/actions.ts', {
    '@/lib/account-amounts': amounts,
    '@/lib/banks': banks,
    '@/lib/format': { formatDateInputValue: () => '' },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath: () => {} },
  })
  return { ...actions, inserts }
}
function form(overrides = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ name: 'Mi tarjeta', bank: 'nu', type: 'credit', initial_balance: '-1234.56', credit_limit: '1000000.50', ...overrides })) data.set(key, value)
  return data
}
test('creation saves debt and credit limit with cents for the authenticated user', async () => {
  const api = setup()
  assert.equal((await api.createAccount(null, form())).ok, true)
  assert.equal(api.inserts[0].initial_balance, -1234.56)
  assert.equal(api.inserts[0].credit_limit, 1000000.50)
  assert.equal(api.inserts[0].user_id, 'current-user')
})
test('every bank in the account selector can be saved, including Finandina', async () => {
  assert.ok(banks.SUPPORTED_BANKS.some((bank) => bank.value === 'finandina' && bank.label === 'Finandina'))
  for (const bank of banks.SUPPORTED_BANKS) {
    const api = setup()
    assert.equal((await api.createAccount(null, form({ bank: bank.value, type: 'debit', initial_balance: '2500.50' }))).ok, true)
    assert.equal(api.inserts[0].bank, bank.value)
    assert.equal(api.inserts[0].initial_balance, 2500.50)
    assert.equal(api.inserts[0].image_path, banks.getDefaultAccountImagePath(bank.value, 'debit'))
  }
  assert.equal(banks.getDefaultAccountImagePath('finandina', 'debit'), null)
  assert.equal(banks.getDefaultAccountImagePath('nu', 'credit'), 'defaults/nu-credit.png')
})
test('bank selector stays alphabetical and matches the database enum migrations', () => {
  const labels = banks.SUPPORTED_BANKS.map((bank) => bank.label)
  assert.deepEqual([...labels], [...labels].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })))
  const sql = readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql')).map((file) => readFileSync(`supabase/migrations/${file}`, 'utf8')).join('\n')
  const initial = sql.match(/create type supported_bank as enum \(([^)]+)\)/)[1]
  const enumValues = [...initial.matchAll(/'([^']+)'/g), ...sql.matchAll(/alter type (?:public\.)?supported_bank add value if not exists '([^']+)'/g)].map((match) => match[1])
  const catalogValues = banks.SUPPORTED_BANKS.map((bank) => bank.value)
  assert.equal(new Set(catalogValues).size, catalogValues.length)
  assert.deepEqual([...catalogValues].sort(), [...new Set(enumValues)].sort())
  const source = ts.createSourceFile('types.ts', readFileSync('src/lib/supabase/types.ts', 'utf8'), ts.ScriptTarget.Latest)
  const bankType = source.statements.find((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'SupportedBank')
  assert.deepEqual(bankType.type.types.map((type) => type.literal.text).sort(), [...catalogValues].sort())
})
test('invalid amounts and negative credit limits are rejected before inserting', async () => {
  for (const overrides of [{ initial_balance: 'abc' }, { credit_limit: '-100' }, { credit_limit: 'abc' }, { type: 'unknown' }, { type: 'savings' }, { type: 'cash' }]) {
    const api = setup()
    assert.equal((await api.createAccount(null, form(overrides))).ok, false)
    assert.equal(api.inserts.length, 0)
  }
})
test('accounts cannot be created without a session', async () => {
  const api = setup(null)
  assert.equal((await api.createAccount(null, form())).ok, false)
  assert.equal(api.inserts.length, 0)
})

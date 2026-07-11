/**
 * Importador del export de Money Manager (.xlsx) a Nexo.
 *
 * Uso:
 *   npx tsx scripts/import-excel.ts <ruta.xlsx> --dry-run   # solo analiza, no toca la BD
 *   npx tsx scripts/import-excel.ts <ruta.xlsx>             # inserta en Supabase
 *
 * Requiere (para modo real) en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID
 *
 * Reglas de transformación:
 *  - Cada fila Transfer-Out -> 1 transferencia (origen=Accounts, destino=Category).
 *    Las filas Transfer-In se descartan (son el espejo).
 *  - Filas "Income Balance" / "Modified Bal." -> ajuste de saldo (adjustment).
 *  - Exp. -> expense ; Income -> income.
 *  - Category + Subcategory -> catálogo jerárquico de categorías.
 */
import { readFileSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Configuración de mapeo
// ---------------------------------------------------------------------------
const ACCOUNT_TYPES: Record<string, 'debit' | 'savings' | 'credit' | 'cash'> = {
  'Rappi Crédito': 'credit',
  'La primera - Nu': 'savings',
  Nu: 'debit',
  Nequi: 'debit',
  Rappi: 'debit',
}
const DEFAULT_ACCOUNT_TYPE = 'debit' as const

type RawRow = {
  Period: unknown
  Accounts: string
  Category: string | null
  Subcategory: string | null
  Note: string | null
  COP: number
  'Income/Expense': string
  Amount: number
  Currency: string
}

type ParsedTx = {
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  amount: number
  occurred_at: string
  account: string
  to_account: string | null
  category: string | null
  subcategory: string | null
  note: string | null
}

// ---------------------------------------------------------------------------
// Parseo del Excel
// ---------------------------------------------------------------------------
// Colombia no observa horario de verano: offset fijo -05:00.
const CO_OFFSET = '-05:00'
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Convierte el valor de fecha del Excel a un ISO con offset de Colombia.
 * El .xlsx guarda la hora "de pared" (local Colombia) como serial. Para
 * evitar depender de la zona horaria de la máquina y el ruido de segundos por
 * punto flotante, redondeamos al minuto y anclamos el offset explícitamente.
 */
function excelDateToISO(v: unknown): string {
  let serial: number
  if (typeof v === 'number') {
    serial = v
  } else if (v instanceof Date) {
    // reconstruye el serial de Excel desde la hora de pared
    serial = 25569 + (v.getTime() - v.getTimezoneOffset() * 60000) / 86400000
  } else {
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) throw new Error(`Fecha no reconocida: ${String(v)}`)
    serial = 25569 + (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000
  }
  // redondea al minuto para eliminar el drift de segundos
  const rounded = Math.round(serial * 1440) / 1440
  const p = XLSX.SSF.parse_date_code(rounded)
  if (!p) throw new Error(`Fecha no reconocida: ${String(v)}`)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}:00${CO_OFFSET}`
}

function parseWorkbook(file: string): ParsedTx[] {
  // sin cellDates: Period llega como serial crudo -> parseo determinista.
  const wb = XLSX.readFile(file, { cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: true })

  const txs: ParsedTx[] = []
  for (const r of rows) {
    if (r.Period == null || r.Accounts == null) continue
    const type = String(r['Income/Expense']).trim()
    const occurred_at = excelDateToISO(r.Period)
    const amount = Number(r.COP ?? r.Amount)
    const note = r.Note ? String(r.Note).trim() : null

    if (type === 'Transfer-In') {
      continue // espejo de Transfer-Out; se descarta
    }
    if (type === 'Transfer-Out') {
      txs.push({
        type: 'transfer',
        amount,
        occurred_at,
        account: String(r.Accounts).trim(),
        to_account: r.Category ? String(r.Category).trim() : null,
        category: null,
        subcategory: null,
        note,
      })
      continue
    }
    if (type === 'Income Balance' || type === 'Modified Bal.') {
      txs.push({
        type: 'adjustment',
        amount, // positivo = subió el saldo
        occurred_at,
        account: String(r.Accounts).trim(),
        to_account: null,
        category: null,
        subcategory: null,
        note: note ?? 'Ajuste de saldo (importado)',
      })
      continue
    }
    // Income / Exp.
    txs.push({
      type: type.startsWith('Income') ? 'income' : 'expense',
      amount,
      occurred_at,
      account: String(r.Accounts).trim(),
      to_account: null,
      category: r.Category ? String(r.Category).trim() : null,
      subcategory: r.Subcategory ? String(r.Subcategory).trim() : null,
      note,
    })
  }
  return txs
}

// ---------------------------------------------------------------------------
// Derivar catálogos (cuentas y categorías) desde los movimientos
// ---------------------------------------------------------------------------
function deriveCatalogs(txs: ParsedTx[]) {
  const accounts = new Set<string>()
  for (const t of txs) {
    accounts.add(t.account)
    if (t.to_account) accounts.add(t.to_account)
  }

  // kind por categoría según mayoría de sus filas
  const catVotes = new Map<string, { income: number; expense: number }>()
  const parents = new Map<string, Set<string>>() // parent -> subcats
  for (const t of txs) {
    if (!t.category || (t.type !== 'income' && t.type !== 'expense')) continue
    const v = catVotes.get(t.category) ?? { income: 0, expense: 0 }
    v[t.type] += 1
    catVotes.set(t.category, v)
    if (!parents.has(t.category)) parents.set(t.category, new Set())
    if (t.subcategory) parents.get(t.category)!.add(t.subcategory)
  }

  const categories = [...catVotes.entries()].map(([name, v]) => ({
    name,
    kind: v.income > v.expense ? ('income' as const) : ('expense' as const),
    subcategories: [...(parents.get(name) ?? [])],
  }))

  return {
    accounts: [...accounts].map((name) => ({
      name,
      type: ACCOUNT_TYPES[name] ?? DEFAULT_ACCOUNT_TYPE,
    })),
    categories,
  }
}

// ---------------------------------------------------------------------------
// Resumen legible
// ---------------------------------------------------------------------------
function summarize(txs: ParsedTx[], catalogs: ReturnType<typeof deriveCatalogs>) {
  const byType = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] ?? 0) + 1
    return acc
  }, {})
  const dates = txs.map((t) => t.occurred_at).sort()
  const fmt = new Intl.NumberFormat('es-CO')
  const sum = (type: string) =>
    fmt.format(txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0))

  console.log('\n─────────── RESUMEN DE IMPORTACIÓN ───────────')
  console.log('Movimientos a crear :', txs.length)
  console.log('Por tipo            :', byType)
  console.log('Rango de fechas     :', dates[0], '→', dates[dates.length - 1])
  console.log('Total ingresos      :', sum('income'), 'COP')
  console.log('Total gastos        :', sum('expense'), 'COP')
  console.log('Total transferencias:', sum('transfer'), 'COP')
  console.log('Total ajustes       :', sum('adjustment'), 'COP')
  console.log('\nCuentas (', catalogs.accounts.length, '):')
  for (const a of catalogs.accounts) console.log('  •', a.name, `(${a.type})`)
  console.log('\nCategorías (', catalogs.categories.length, '):')
  for (const c of catalogs.categories) {
    const subs = c.subcategories.length ? ` → ${c.subcategories.join(', ')}` : ''
    console.log(`  • ${c.name} [${c.kind}]${subs}`)
  }
  console.log('───────────────────────────────────────────────\n')
}

// ---------------------------------------------------------------------------
// Inserción en Supabase (modo real)
// ---------------------------------------------------------------------------
async function loadToSupabase(
  txs: ParsedTx[],
  catalogs: ReturnType<typeof deriveCatalogs>,
  sourceFile: string
) {
  // carga .env.local si existe (Node 20.12+)
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // sin archivo: se usan las variables ya presentes en el entorno
  }
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userId = process.env.IMPORT_USER_ID
  if (!url || !key || !userId) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o IMPORT_USER_ID en el entorno.'
    )
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  // 1) batch de importación (para poder deshacer)
  const { data: batch, error: batchErr } = await db
    .from('import_batches')
    .insert({ user_id: userId, source_file: sourceFile, row_count: txs.length })
    .select('id')
    .single()
  if (batchErr) throw batchErr
  const batchId = batch.id

  // 2) cuentas (upsert por nombre)
  const { data: accRows, error: accErr } = await db
    .from('accounts')
    .upsert(
      catalogs.accounts.map((a) => ({ user_id: userId, name: a.name, type: a.type })),
      { onConflict: 'user_id,name' }
    )
    .select('id,name')
  if (accErr) throw accErr
  const accountId = new Map(accRows!.map((a) => [a.name, a.id]))

  // 3) categorías padre
  const { data: parentRows, error: pErr } = await db
    .from('categories')
    .upsert(
      catalogs.categories.map((c) => ({ user_id: userId, name: c.name, kind: c.kind })),
      { onConflict: 'user_id,parent_id,name' }
    )
    .select('id,name')
  if (pErr) throw pErr
  const parentId = new Map(parentRows!.map((c) => [c.name, c.id]))

  // 4) subcategorías
  const subInserts = catalogs.categories.flatMap((c) =>
    c.subcategories.map((s) => ({
      user_id: userId,
      name: s,
      kind: c.kind,
      parent_id: parentId.get(c.name)!,
    }))
  )
  const subId = new Map<string, string>() // "parent/sub" -> id
  if (subInserts.length) {
    const { data: subRows, error: sErr } = await db
      .from('categories')
      .upsert(subInserts, { onConflict: 'user_id,parent_id,name' })
      .select('id,name,parent_id')
    if (sErr) throw sErr
    const parentNameById = new Map(parentRows!.map((p) => [p.id, p.name]))
    for (const s of subRows!) {
      subId.set(`${parentNameById.get(s.parent_id!)}/${s.name}`, s.id)
    }
  }

  // 5) movimientos
  const inserts = txs.map((t) => {
    let category_id: string | null = null
    if (t.category) {
      category_id = t.subcategory
        ? subId.get(`${t.category}/${t.subcategory}`) ?? parentId.get(t.category) ?? null
        : parentId.get(t.category) ?? null
    }
    return {
      user_id: userId,
      type: t.type,
      amount: t.amount,
      occurred_at: t.occurred_at,
      account_id: accountId.get(t.account)!,
      to_account_id: t.to_account ? accountId.get(t.to_account)! : null,
      category_id,
      note: t.note,
      source: 'import' as const,
      import_batch_id: batchId,
    }
  })

  // en lotes de 200
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200)
    const { error } = await db.from('transactions').insert(chunk)
    if (error) throw error
  }

  console.log(`✅ Importados ${inserts.length} movimientos (batch ${batchId}).`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  if (!file) {
    console.error('Uso: npx tsx scripts/import-excel.ts <ruta.xlsx> [--dry-run]')
    process.exit(1)
  }
  readFileSync(file) // valida existencia

  const txs = parseWorkbook(file)
  const catalogs = deriveCatalogs(txs)
  summarize(txs, catalogs)

  if (dryRun) {
    const outPath = path.join(
      process.cwd(),
      'scripts',
      'import-preview.json'
    )
    writeFileSync(outPath, JSON.stringify({ catalogs, txs }, null, 2))
    console.log('DRY-RUN: nada se escribió en la BD. Vista previa en', outPath)
    return
  }

  await loadToSupabase(txs, catalogs, path.basename(file))
}

main().catch((err) => {
  console.error('❌ Error:', err.message ?? err)
  process.exit(1)
})

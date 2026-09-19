import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticateShortcut } from '@/lib/shortcuts/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const transactionSchema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    amount: z.coerce.number().positive().finite().max(999_999_999_999),
    account_id: z.string().uuid(),
    to_account_id: z.string().uuid().nullish(),
    category_id: z.string().uuid().nullish(),
    note: z.string().trim().max(240).nullish(),
    idempotency_key: z.string().uuid().optional(),
  })
  .superRefine((input, context) => {
    if (input.type === 'transfer' && !input.to_account_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_account_id'],
        message: 'Una transferencia necesita una cuenta destino.',
      })
    }
    if (input.type !== 'transfer' && input.to_account_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_account_id'],
        message: 'Solo las transferencias pueden tener una cuenta destino.',
      })
    }
    if (input.type === 'transfer' && input.category_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category_id'],
        message: 'Las transferencias no llevan categoría.',
      })
    }
    if (input.to_account_id === input.account_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_account_id'],
        message: 'Las cuentas de origen y destino deben ser distintas.',
      })
    }
  })

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function categorySortName(label: string) {
  // Los emojis identifican visualmente la categoría, pero no definen su orden alfabético.
  return label.replace(/^[^\p{L}\p{N}]+/u, '').trimStart()
}

export async function GET(request: Request) {
  const auth = await authenticateShortcut(request)
  if (!auth) return json({ ok: false, message: 'Credencial inválida o revocada.' }, 401)

  const [accountsResult, categoriesResult] = await Promise.all([
    auth.admin
      .from('accounts')
      .select('id,name,type,bank')
      .eq('user_id', auth.userId)
      .eq('archived', false)
      .order('name'),
    auth.admin
      .from('categories')
      .select('id,name,kind,parent_id')
      .eq('user_id', auth.userId)
      .eq('is_suggested', false)
      .order('name'),
  ])

  if (accountsResult.error || categoriesResult.error) {
    return json({ ok: false, message: 'No se pudieron cargar las cuentas y categorías.' }, 500)
  }

  const accounts = accountsResult.data ?? []
  const rawCategories = categoriesResult.data ?? []
  const namesById = new Map(rawCategories.map((category) => [category.id, category.name]))
  const categoriesWithLabels = rawCategories.map((category) => ({
    ...category,
    label: category.parent_id && namesById.has(category.parent_id)
      ? `${namesById.get(category.parent_id)} / ${category.name}`
      : category.name,
  }))
  const labelCounts = new Map<string, number>()
  for (const category of categoriesWithLabels) {
    const key = `${category.kind}:${category.label}`
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1)
  }
  const categories = categoriesWithLabels
    .map((category) => ({
      ...category,
      label: (labelCounts.get(`${category.kind}:${category.label}`) ?? 0) > 1
        ? `${category.label} (${category.id})`
        : category.label,
    }))
    .sort((a, b) =>
      categorySortName(a.label).localeCompare(categorySortName(b.label), 'es', { sensitivity: 'base' }) ||
      a.label.localeCompare(b.label, 'es') ||
      a.id.localeCompare(b.id)
    )
  const categoryLabels = {
    expense: categories.filter((category) => category.kind === 'expense').map((category) => category.label),
    income: categories.filter((category) => category.kind === 'income').map((category) => category.label),
  }
  const categoriesByName = {
    expense: Object.fromEntries(
      categories.filter((category) => category.kind === 'expense').map((category) => [category.label, category.id])
    ),
    income: Object.fromEntries(
      categories.filter((category) => category.kind === 'income').map((category) => [category.label, category.id])
    ),
  }

  await auth.admin
    .from('shortcut_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', auth.tokenId)

  return json({
    ok: true,
    accounts,
    accounts_by_name: Object.fromEntries(accounts.map((account) => [account.name, account.id])),
    categories,
    category_labels: categoryLabels,
    categories_by_name: categoriesByName,
  })
}

export async function POST(request: Request) {
  const auth = await authenticateShortcut(request)
  if (!auth) return json({ ok: false, message: 'Credencial inválida o revocada.' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, message: 'El contenido enviado no es JSON válido.' }, 400)
  }

  const parsed = transactionSchema.safeParse(body)
  if (!parsed.success) {
    return json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Movimiento inválido.',
      },
      400
    )
  }

  const input = parsed.data
  const accountIds = [input.account_id, input.to_account_id].filter(
    (value): value is string => Boolean(value)
  )
  const { data: ownedAccounts, error: accountsError } = await auth.admin
    .from('accounts')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('archived', false)
    .in('id', accountIds)

  if (accountsError || ownedAccounts?.length !== accountIds.length) {
    return json({ ok: false, message: 'Alguna de las cuentas no es válida.' }, 400)
  }

  if (input.category_id) {
    const expectedKind = input.type === 'income' ? 'income' : 'expense'
    const { data: category, error: categoryError } = await auth.admin
      .from('categories')
      .select('id')
      .eq('id', input.category_id)
      .eq('user_id', auth.userId)
      .eq('kind', expectedKind)
      .eq('is_suggested', false)
      .maybeSingle()
    if (categoryError || !category) {
      return json({ ok: false, message: 'La categoría no es válida.' }, 400)
    }
  }

  const idempotencyKey = input.idempotency_key ?? randomUUID()
  const externalRef = `shortcut:${idempotencyKey}`
  const { data: existing, error: existingError } = await auth.admin
    .from('transactions')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('external_ref', externalRef)
    .maybeSingle()

  if (existingError) {
    return json({ ok: false, message: 'No se pudo comprobar el movimiento.' }, 500)
  }
  if (existing) {
    return json({ ok: true, duplicate: true, transaction_id: existing.id, message: 'Movimiento registrado.' })
  }

  const { data: transaction, error: insertError } = await auth.admin
    .from('transactions')
    .insert({
      user_id: auth.userId,
      type: input.type,
      amount: input.amount,
      account_id: input.account_id,
      to_account_id: input.type === 'transfer' ? input.to_account_id : null,
      category_id: input.type === 'transfer' ? null : input.category_id ?? null,
      note: input.note || null,
      source: 'shortcut',
      external_ref: externalRef,
    })
    .select('id,occurred_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return json({ ok: true, duplicate: true, message: 'Movimiento registrado.' })
    }
    console.error('Shortcut transaction insert failed', insertError)
    return json({ ok: false, message: 'No se pudo registrar el movimiento.' }, 500)
  }

  await auth.admin
    .from('shortcut_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', auth.tokenId)

  return json({
    ok: true,
    duplicate: false,
    transaction_id: transaction.id,
    occurred_at: transaction.occurred_at,
    message: 'Movimiento registrado.',
  })
}

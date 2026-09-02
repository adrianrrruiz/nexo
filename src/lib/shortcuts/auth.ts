import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const TOKEN_PATTERN = /^nexo_sk_[A-Za-z0-9_-]{43}$/

export function hashShortcutToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function authenticateShortcut(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const [scheme, token, extra] = authorization.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra || !TOKEN_PATTERN.test(token)) {
    return null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shortcut_tokens')
    .select('id,user_id')
    .eq('token_hash', hashShortcutToken(token))
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null

  return { admin, tokenId: data.id, userId: data.user_id }
}

import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Supabase Auth todavía no admite scopes personalizados. `email` es el scope
// estándar mínimo y el acceso financiero sigue limitado por las herramientas
// de solo lectura y por el user_id verificado del token.
const READ_SCOPE = 'email'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let authClient: SupabaseClient<Database> | null = null

function getRequiredEnv(
  name:
    | 'NEXT_PUBLIC_SUPABASE_URL'
    | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    | 'MCP_USER_ID'
) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  if (name === 'MCP_USER_ID' && !UUID_PATTERN.test(value)) {
    throw new Error('MCP_USER_ID must be a valid UUID.')
  }
  return value
}

function getAuthClient() {
  if (authClient) return authClient

  authClient = createClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  )

  return authClient
}

export function getSupabaseOAuthIssuer() {
  return `${getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')}/auth/v1`
}

function matchesToken(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}

export async function verifyMcpToken(
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  // Compatibilidad temporal con Claude Code mientras se migra al conector
  // OAuth. Estas variables podrán eliminarse después de verificar el flujo.
  const legacyToken = process.env.MCP_ACCESS_TOKEN?.trim()
  if (
    legacyToken &&
    legacyToken.length >= 32 &&
    matchesToken(bearerToken, legacyToken)
  ) {
    return {
      token: bearerToken,
      scopes: [READ_SCOPE],
      clientId: 'claude-code-legacy',
      extra: {
        userId: getRequiredEnv('MCP_USER_ID'),
        authenticationMethod: 'legacy-token',
      },
    }
  }

  const supabase = getAuthClient()
  const [{ data: claimsData, error: claimsError }, { data: userData, error: userError }] =
    await Promise.all([
      supabase.auth.getClaims(bearerToken),
      supabase.auth.getUser(bearerToken),
    ])

  if (claimsError || userError || !claimsData?.claims || !userData.user) {
    return undefined
  }

  const claims = claimsData.claims
  const clientId =
    typeof claims.client_id === 'string' ? claims.client_id.trim() : ''
  const userId = claims.sub

  // Exige un token emitido mediante el servidor OAuth, no una sesión normal
  // de la PWA. La identidad se valida tanto criptográficamente como contra el
  // servidor de Auth para respetar revocaciones y usuarios eliminados.
  if (
    claims.iss !== getSupabaseOAuthIssuer() ||
    claims.role !== 'authenticated' ||
    !clientId ||
    !UUID_PATTERN.test(userId) ||
    userData.user.id !== userId
  ) {
    return undefined
  }

  const scopes =
    typeof claims.scope === 'string'
      ? claims.scope.split(/\s+/).filter(Boolean)
      : [READ_SCOPE]

  return {
    token: bearerToken,
    scopes: scopes.length > 0 ? scopes : [READ_SCOPE],
    clientId,
    expiresAt: claims.exp,
    extra: {
      userId,
      authenticationMethod: 'supabase-oauth',
    },
  }
}

export function getMcpUserId(authInfo?: AuthInfo) {
  const userId = authInfo?.extra?.userId
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    throw new Error('The MCP request does not contain a valid authenticated user.')
  }
  return userId
}

export const MCP_READ_SCOPE = READ_SCOPE

import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

const READ_SCOPE = 'finance:read'

function getRequiredEnv(name: 'MCP_ACCESS_TOKEN' | 'MCP_USER_ID') {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  if (
    name === 'MCP_USER_ID' &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new Error('MCP_USER_ID must be a valid UUID.')
  }
  return value
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

  const expectedToken = getRequiredEnv('MCP_ACCESS_TOKEN')
  if (expectedToken.length < 32 || !matchesToken(bearerToken, expectedToken)) {
    return undefined
  }

  return {
    token: bearerToken,
    scopes: [READ_SCOPE],
    clientId: 'claude-code',
    extra: {
      userId: getRequiredEnv('MCP_USER_ID'),
    },
  }
}

export function getMcpUserId() {
  return getRequiredEnv('MCP_USER_ID')
}

export const MCP_READ_SCOPE = READ_SCOPE

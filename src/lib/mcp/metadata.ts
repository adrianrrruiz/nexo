import 'server-only'

import {
  generateProtectedResourceMetadata,
  getPublicOrigin,
} from 'mcp-handler'
import { getSupabaseOAuthIssuer, MCP_READ_SCOPE } from '@/lib/mcp/auth'

export function protectedResourceMetadataResponse(request: Request) {
  const origin = getPublicOrigin(request)
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [getSupabaseOAuthIssuer()],
    resourceUrl: `${origin}/api/mcp`,
    additionalMetadata: {
      scopes_supported: [MCP_READ_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Nexo — finanzas personales',
    },
  })

  return Response.json(metadata, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export function protectedResourceMetadataOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  })
}

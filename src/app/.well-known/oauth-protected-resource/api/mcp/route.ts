import {
  protectedResourceMetadataOptions,
  protectedResourceMetadataResponse,
} from '@/lib/mcp/metadata'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return protectedResourceMetadataResponse(request)
}

export function OPTIONS() {
  return protectedResourceMetadataOptions()
}

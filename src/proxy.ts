import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Todo menos assets estáticos, imágenes, manifest y el service worker.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-.*|apple-touch-icon.png).*)',
  ],
}

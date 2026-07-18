import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

/**
 * Refresca la sesión de Supabase en cada request y protege rutas.
 * Basado en el patrón oficial de @supabase/ssr para Next.js App Router.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // El MCP remoto no usa la cookie de la PWA. Su Route Handler valida un
  // Bearer token propio antes de permitir cualquier consulta financiera.
  if (pathname.startsWith('/api/mcp')) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth')

  // Sin sesión y en ruta privada -> a /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')

  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
  }

  const formData = await request.formData()
  const authorizationId = String(formData.get('authorization_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '')

  if (!authorizationId || authorizationId.length > 512) {
    return NextResponse.json(
      { error: 'Solicitud de autorización inválida.' },
      { status: 400 }
    )
  }
  if (decision !== 'approve' && decision !== 'deny') {
    return NextResponse.json({ error: 'Decisión inválida.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()

  if (!claimsData?.claims) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
  }

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json(
      { error: 'No se pudo completar la autorización.' },
      { status: 400 }
    )
  }

  return NextResponse.redirect(result.data.redirect_url, 303)
}

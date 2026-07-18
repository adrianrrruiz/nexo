import { redirect } from 'next/navigation'
import DeveloperFooter from '@/components/DeveloperFooter'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/server'

const SCOPE_LABELS: Record<string, string> = {
  email: 'Confirmar la identidad de tu cuenta de Nexo',
  openid: 'Identificar tu cuenta mediante OpenID Connect',
  profile: 'Consultar la información básica de tu perfil',
  phone: 'Consultar el teléfono asociado a tu cuenta',
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>
}) {
  const { authorization_id: authorizationId } = await searchParams

  if (!authorizationId) {
    return <ConsentError message="Falta el identificador de autorización." />
  }

  const consentPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()

  if (!claimsData?.claims) {
    redirect(`/login?redirect=${encodeURIComponent(consentPath)}`)
  }

  const { data: authorization, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !authorization) {
    return (
      <ConsentError message="La solicitud venció o ya no es válida. Vuelve a conectar Nexo desde Claude." />
    )
  }

  if (!('authorization_id' in authorization)) {
    redirect(authorization.redirect_url)
  }

  const scopes = authorization.scope.split(/\s+/).filter(Boolean)

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-surface/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <Logo className="h-11 w-11" id="nexo-logo-oauth-consent" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
              Conectar con Nexo
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Autorizar a {authorization.client.name}
            </h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-neutral-300">
          Claude solicita usar las herramientas financieras de solo lectura de
          Nexo. Podrá consultar tus cuentas, movimientos, saldos y resúmenes,
          pero no crear, editar ni eliminar información.
        </p>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Permisos solicitados
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-200">
            <li className="flex gap-2">
              <span aria-hidden className="text-brand">✓</span>
              Leer exclusivamente tus datos financieros
            </li>
            {scopes.map((scope) => (
              <li key={scope} className="flex gap-2">
                <span aria-hidden className="text-brand">✓</span>
                {SCOPE_LABELS[scope] ?? `Permiso OAuth: ${scope}`}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-xs leading-5 text-neutral-500">
          Estás autorizando desde {authorization.user.email}. Podrás revocar
          este acceso desconectando Nexo desde Claude.
        </p>

        <form action="/api/oauth/decision" method="post" className="mt-7 space-y-3">
          <input
            type="hidden"
            name="authorization_id"
            value={authorization.authorization_id}
          />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 shadow-lg shadow-brand/20 active:opacity-90"
          >
            Autorizar conexión
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] py-3.5 font-medium text-neutral-300 active:bg-white/[0.06]"
          >
            Cancelar
          </button>
        </form>
      </section>
    </main>
  )
}

function ConsentError({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto h-14 w-14" id="nexo-logo-oauth-error" />
        <h1 className="mt-5 text-2xl font-semibold">No se pudo autorizar</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">{message}</p>
        <DeveloperFooter className="mt-10" />
      </div>
    </main>
  )
}

import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || 'N'
  const since = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
      })
    : null

  return (
    <>
      <header className="mb-8">
        <h1 className="text-xl font-semibold">Perfil</h1>
      </header>

      <div className="mb-6 flex flex-col items-center rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-3xl font-bold text-neutral-950">
          {initial}
        </div>
        <p className="mt-4 max-w-full truncate text-sm font-medium">{email}</p>
        {since && (
          <p className="mt-1 text-xs text-neutral-500">En Nexo desde {since}</p>
        )}
      </div>

      <div className="mb-6 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" id="nexo-logo-perfil" />
          <div>
            <p className="text-sm font-medium">Nexo</p>
            <p className="text-xs text-neutral-500">
              Tus finanzas personales, con el control de tus datos.
            </p>
          </div>
        </div>
      </div>

      <form action="/auth/signout" method="post">
        <button className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 active:bg-red-500/20">
          Cerrar sesión
        </button>
      </form>
    </>
  )
}

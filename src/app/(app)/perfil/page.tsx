import { createClient } from '@/lib/supabase/server'
import { createProfileAvatarUrl } from '@/lib/account-images'
import ProfileAvatarUploader from '@/components/ProfileAvatarUploader'
import ProfileForm from '@/components/ProfileForm'
import Logo from '@/components/Logo'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profileData } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    : { data: null }

  const profile = profileData as Profile | null
  const avatarUrl = await createProfileAvatarUrl(profile?.avatar_path ?? null)

  const email = user?.email ?? ''
  const displayName = profile?.full_name?.trim() || email.split('@')[0] || 'Nexo'
  const initial = displayName.charAt(0).toUpperCase() || 'N'
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
        <ProfileAvatarUploader initial={initial} imageUrl={avatarUrl} />
        <p className="mt-4 max-w-full truncate text-sm font-medium">{displayName}</p>
        <p className="mt-1 max-w-full truncate text-xs text-neutral-500">{email}</p>
        {since && (
          <p className="mt-1 text-xs text-neutral-500">En Nexo desde {since}</p>
        )}
        <ProfileForm fullName={profile?.full_name ?? ''} />
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

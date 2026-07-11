'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileState } from '@/app/(app)/perfil/actions'

export default function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    null
  )

  return (
    <form action={action} className="mt-5 w-full space-y-3">
      <input
        name="full_name"
        defaultValue={fullName}
        placeholder="Nombre"
        className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-center text-base outline-none focus:border-brand/60"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-neutral-950 disabled:opacity-60"
      >
        {pending ? 'Guardando...' : 'Guardar perfil'}
      </button>
      {state && (
        <p className={`text-center text-sm ${state.ok ? 'text-brand' : 'text-red-400'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}

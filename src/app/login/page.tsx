'use client'

import { useActionState } from 'react'
import { sendMagicLink, type LoginState } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    null
  )

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl font-bold">
            N
          </div>
          <h1 className="text-2xl font-semibold">Nexo</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Tus finanzas personales, con el control de tus datos.
          </p>
        </div>

        <form action={formAction} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-base outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 py-3 font-medium disabled:opacity-60 active:bg-indigo-700"
          >
            {pending ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>
        </form>

        {state && (
          <p
            className={`mt-4 text-center text-sm ${
              state.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </main>
  )
}

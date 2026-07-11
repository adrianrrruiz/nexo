'use client'

import { useActionState, useState } from 'react'
import { requestOtp, verifyOtp, type LoginState } from './actions'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const [reqState, requestAction, reqPending] = useActionState<
    LoginState,
    FormData
  >(async (prev, fd) => {
    const res = await requestOtp(prev, fd)
    if (res?.ok) {
      setEmail(res.email ?? '')
      setSent(true)
    }
    return res
  }, null)

  const [verState, verifyAction, verPending] = useActionState<
    LoginState,
    FormData
  >(verifyOtp, null)

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

        {!sent ? (
          <form action={requestAction} className="space-y-3">
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
              disabled={reqPending}
              className="w-full rounded-xl bg-indigo-600 py-3 font-medium disabled:opacity-60 active:bg-indigo-700"
            >
              {reqPending ? 'Enviando…' : 'Enviar código'}
            </button>
            {reqState && !reqState.ok && (
              <p className="text-center text-sm text-red-400">{reqState.message}</p>
            )}
          </form>
        ) : (
          <form action={verifyAction} className="space-y-3">
            <input type="hidden" name="email" value={email} />
            <p className="text-center text-sm text-neutral-400">
              Código enviado a <span className="text-neutral-200">{email}</span>
            </p>
            <input
              type="text"
              name="token"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={verPending}
              className="w-full rounded-xl bg-indigo-600 py-3 font-medium disabled:opacity-60 active:bg-indigo-700"
            >
              {verPending ? 'Verificando…' : 'Entrar'}
            </button>
            {verState && !verState.ok && (
              <p className="text-center text-sm text-red-400">{verState.message}</p>
            )}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="w-full text-center text-xs text-neutral-500 underline"
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

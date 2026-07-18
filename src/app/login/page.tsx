'use client'

import { Suspense, useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DeveloperFooter from '@/components/DeveloperFooter'
import Logo from '@/components/Logo'
import { requestOtp, verifyOtp, type LoginState } from './actions'

const FIELD =
  'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-base outline-none transition-colors focus:border-brand/60'

const PRIMARY =
  'w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 font-semibold text-neutral-950 shadow-lg shadow-brand/20 disabled:opacity-60 active:opacity-90'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') ?? ''
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
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="relative mx-auto mb-5 w-fit">
            {/* glow detrás del logo */}
            <div className="absolute inset-0 scale-150 rounded-full bg-brand/20 blur-2xl" />
            <Logo className="relative h-16 w-16" id="nexo-logo-login" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Nexo</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Claridad. Control. Crecimiento.
          </p>
        </div>

        {!sent ? (
          <form action={requestAction} className="space-y-3">
            <input type="hidden" name="redirect" value={redirectPath} />
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              className={FIELD}
            />
            <button type="submit" disabled={reqPending} className={PRIMARY}>
              {reqPending ? 'Enviando…' : 'Enviar código'}
            </button>
            {reqState && !reqState.ok && (
              <p className="text-center text-sm text-red-400">{reqState.message}</p>
            )}
          </form>
        ) : (
          <form action={verifyAction} className="space-y-3">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="redirect" value={redirectPath} />
            <p className="text-center text-sm text-neutral-400">
              Código enviado a <span className="text-neutral-100">{email}</span>
            </p>
            <input
              type="text"
              name="token"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="00000000"
              className={`${FIELD} text-center text-2xl font-semibold tracking-[0.3em]`}
            />
            <button type="submit" disabled={verPending} className={PRIMARY}>
              {verPending ? 'Verificando…' : 'Entrar'}
            </button>
            {verState && !verState.ok && (
              <p className="text-center text-sm text-red-400">{verState.message}</p>
            )}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="w-full text-center text-xs text-neutral-500 underline underline-offset-2"
            >
              Usar otro correo
            </button>
          </form>
        )}
        <DeveloperFooter className="mt-10" />
      </div>
    </main>
  )
}

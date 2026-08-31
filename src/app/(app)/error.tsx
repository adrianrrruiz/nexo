'use client'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="w-full max-w-lg rounded-[28px] border border-amber-400/15 bg-amber-400/[0.05] p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-xl text-amber-300">
          !
        </span>
        <h1 className="mt-4 text-lg font-semibold">No pudimos verificar tus números</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Para no mostrar saldos incompletos o incorrectos, Nexo detuvo esta carga. Reintenta la
          consulta cuando tengas conexión.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-neutral-950"
        >
          Volver a intentar
        </button>
      </section>
    </div>
  )
}

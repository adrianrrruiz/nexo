'use client'

import { useActionState, useState } from 'react'
import {
  generateShortcutToken,
  revokeShortcutToken,
  type ShortcutTokenState,
} from '@/app/(app)/perfil/actions'

const ENDPOINT = 'https://nexo-adrianrrruiz.vercel.app/api/shortcuts'

export default function ShortcutIntegration({
  active,
  createdAt,
  lastUsedAt,
}: {
  active: boolean
  createdAt?: string | null
  lastUsedAt?: string | null
}) {
  const [generateState, generateAction, generating] = useActionState<
    ShortcutTokenState,
    FormData
  >(generateShortcutToken, null)
  const [revokeState, revokeAction, revoking] = useActionState<
    ShortcutTokenState,
    FormData
  >(revokeShortcutToken, null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const wasRevoked = Boolean(revokeState?.ok)
  const currentlyActive = wasRevoked
    ? false
    : active || Boolean(generateState?.ok && generateState.token)
  const visibleToken = wasRevoked ? null : generateState?.token

  const copyToken = async () => {
    if (!visibleToken) return
    try {
      await navigator.clipboard.writeText(visibleToken)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <section className="mt-6 rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                <path d="M10 5h4M11 18.5h2" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-semibold">Atajo de iPhone</h2>
              <p className="text-xs text-neutral-500">Registro directo sin abrir Nexo</p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">
            La credencial permite crear movimientos y consultar únicamente los nombres e
            identificadores de tus cuentas activas. Puedes revocarla en cualquier momento.
          </p>
          {currentlyActive && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span className="font-medium text-brand">● Credencial activa</span>
              {createdAt && <span>Creada {formatDate(createdAt)}</span>}
              {lastUsedAt && <span>Último uso {formatDate(lastUsedAt)}</span>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <form action={generateAction}>
            <button
              type="submit"
              disabled={generating}
              className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-60"
            >
              {generating ? 'Generando…' : currentlyActive ? 'Reemplazar clave' : 'Generar clave'}
            </button>
          </form>
          {currentlyActive && (
            <form action={revokeAction}>
              <button
                type="submit"
                disabled={revoking}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 disabled:opacity-60"
              >
                {revoking ? 'Revocando…' : 'Revocar'}
              </button>
            </form>
          )}
        </div>
      </div>

      {visibleToken && (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[0.07] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Copia esta clave ahora
          </p>
          <code className="mt-2 block break-all text-xs leading-5 text-neutral-200">
            {visibleToken}
          </code>
          <button
            type="button"
            onClick={() => void copyToken()}
            className="mt-3 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-neutral-950"
          >
            {copied ? 'Copiada' : 'Copiar clave'}
          </button>
          {copyError ? (
            <p className="mt-2 text-xs text-red-400">
              No se pudo copiar automáticamente. Mantén presionada la clave para copiarla.
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-neutral-400">
            {generateState?.message}
          </p>
        </div>
      )}

      {generateState && !generateState.ok && (
        <p className="mt-4 text-sm text-red-400">{generateState.message}</p>
      )}
      {revokeState && (
        <p className={`mt-4 text-sm ${revokeState.ok ? 'text-brand' : 'text-red-400'}`}>
          {revokeState.message}
        </p>
      )}

      <div className="mt-7 border-t border-white/[0.06] pt-6">
        <h3 className="text-sm font-semibold">Configuración del atajo</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Usa esta dirección tanto para consultar cuentas como para guardar el movimiento:
        </p>
        <code className="mt-3 block overflow-x-auto rounded-xl bg-black/25 px-3 py-2 text-xs text-neutral-300">
          {ENDPOINT}
        </code>

        <ol className="mt-5 grid gap-3 text-sm leading-6 text-neutral-300 lg:grid-cols-2">
          <Instruction number="1" text="Solicitar entrada de tipo Número para el monto." />
          <Instruction number="2" text="Elegir del menú: Gasto, Ingreso o Transferencia; guarda expense, income o transfer." />
          <Instruction number="3" text="Haz GET al endpoint con Authorization: Bearer TU_CLAVE y toma accounts_by_name." />
          <Instruction number="4" text="Elige una cuenta de sus claves y recupera su UUID. En transferencias, repite para el destino." />
          <Instruction number="5" text="Solicita una nota de texto; puede quedar vacía. Añade también la acción Generar UUID." />
          <Instruction number="6" text="Haz POST JSON al mismo endpoint con type, amount, account_id, to_account_id, note e idempotency_key." />
          <Instruction number="7" text="Obtén message de la respuesta y usa Mostrar resultado." />
          <Instruction number="8" text="Asigna el atajo a Tocar atrás → Doble toque." />
        </ol>

        <details className="mt-5 rounded-2xl border border-white/[0.06] bg-black/15 p-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-200">
            Cuerpo JSON del POST
          </summary>
          <pre className="mt-3 overflow-x-auto text-xs leading-5 text-neutral-400">{`{
  "type": "expense",
  "amount": 25000,
  "account_id": "UUID_DE_LA_CUENTA",
  "to_account_id": null,
  "note": "Almuerzo",
  "idempotency_key": "UUID_GENERADO_POR_ATAJOS"
}`}</pre>
        </details>
      </div>
    </section>
  )
}

function Instruction({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
        {number}
      </span>
      <span>{text}</span>
    </li>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

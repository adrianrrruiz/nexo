'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ACCOUNT_STATEMENTS_BUCKET,
  MAX_STATEMENT_SIZE_BYTES,
} from '@/lib/statement-config'
import type { AccountStatement } from '@/lib/supabase/types'
import { openNativePicker } from '@/lib/native-picker'

const FIELD =
  'w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm outline-none focus:border-brand/60'

type StatementItem = Pick<
  AccountStatement,
  | 'id'
  | 'period'
  | 'original_filename'
  | 'storage_path'
  | 'size_bytes'
  | 'created_at'
> & { signedUrl: string | null }

export default function AccountStatementManager({
  accountId,
  statements,
}: {
  accountId: string
  statements: StatementItem[]
}) {
  const router = useRouter()
  const [period, setPeriod] = useState(currentMonth())
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  async function uploadStatement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setStatus(null)

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      setStatus({ ok: false, message: 'Selecciona el período del extracto.' })
      return
    }
    if (!file) {
      setStatus({ ok: false, message: 'Selecciona un archivo PDF.' })
      return
    }
    if (file.size === 0 || file.size > MAX_STATEMENT_SIZE_BYTES) {
      setStatus({ ok: false, message: 'El PDF debe pesar máximo 20 MB.' })
      return
    }

    const signature = await file.slice(0, 5).text()
    if (signature !== '%PDF-') {
      setStatus({ ok: false, message: 'El archivo seleccionado no es un PDF válido.' })
      return
    }

    setUploading(true)
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setStatus({ ok: false, message: 'Sesión expirada.' })
      setUploading(false)
      return
    }

    const storagePath = `${user.id}/${accountId}/${crypto.randomUUID()}.pdf`
    const uploaded = await supabase.storage
      .from(ACCOUNT_STATEMENTS_BUCKET)
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      })

    if (uploaded.error) {
      setStatus({ ok: false, message: uploaded.error.message })
      setUploading(false)
      return
    }

    const inserted = await supabase.from('account_statements').insert({
      user_id: user.id,
      account_id: accountId,
      period: `${period}-01`,
      original_filename: file.name.slice(0, 255),
      storage_path: storagePath,
      mime_type: 'application/pdf',
      size_bytes: file.size,
    })

    if (inserted.error) {
      await supabase.storage.from(ACCOUNT_STATEMENTS_BUCKET).remove([storagePath])
      setStatus({ ok: false, message: inserted.error.message })
      setUploading(false)
      return
    }

    setFile(null)
    setStatus({ ok: true, message: 'Extracto guardado.' })
    setUploading(false)
    form.reset()
    setPeriod(currentMonth())
    router.refresh()
  }

  async function deleteStatement(statement: StatementItem) {
    if (!confirm(`¿Eliminar ${statement.original_filename}?`)) return

    setStatus(null)
    setDeletingId(statement.id)
    const supabase = createClient()
    const deleted = await supabase
      .from('account_statements')
      .delete()
      .eq('id', statement.id)
      .eq('account_id', accountId)

    if (deleted.error) {
      setStatus({ ok: false, message: deleted.error.message })
      setDeletingId(null)
      return
    }

    const removed = await supabase.storage
      .from(ACCOUNT_STATEMENTS_BUCKET)
      .remove([statement.storage_path])

    setStatus(
      removed.error
        ? { ok: false, message: 'Se eliminó el registro, pero no se pudo borrar el archivo.' }
        : { ok: true, message: 'Extracto eliminado.' }
    )
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <form
        onSubmit={(event) => void uploadStatement(event)}
        className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-5 lg:sticky lg:top-8"
      >
        <h2 className="text-base font-semibold">Subir extracto</h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          PDF de máximo 20 MB. El contenido permanece privado.
        </p>

        <label className="mt-5 block text-xs font-medium text-neutral-400">
          Período
          <input
            type="month"
            required
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            onClick={(event) => openNativePicker(event.currentTarget)}
            className={`${FIELD} mt-2`}
          />
        </label>

        <label className="mt-4 block text-xs font-medium text-neutral-400">
          Archivo
          <input
            type="file"
            required
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={`${FIELD} mt-2 file:mr-3 file:rounded-xl file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand`}
          />
        </label>

        <button
          type="submit"
          disabled={uploading}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 text-sm font-semibold text-neutral-950 disabled:opacity-60"
        >
          {uploading ? 'Subiendo…' : 'Guardar extracto'}
        </button>

        {status ? (
          <p
            aria-live="polite"
            className={`mt-3 text-center text-sm ${status.ok ? 'text-brand' : 'text-red-400'}`}
          >
            {status.message}
          </p>
        ) : null}
      </form>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Historial</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {statements.length} {statements.length === 1 ? 'extracto' : 'extractos'}
            </p>
          </div>
        </div>

        {statements.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-neutral-300">Aún no hay extractos.</p>
            <p className="mt-2 text-xs text-neutral-500">
              Sube el primer PDF para comenzar el historial de esta cuenta.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {statements.map((statement) => (
              <article
                key={statement.id}
                className="flex items-center gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                  <PdfIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{statement.original_filename}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatPeriod(statement.period)} · {formatSize(statement.size_bytes)} ·{' '}
                    {formatDate(statement.created_at)}
                  </p>
                </div>
                {statement.signedUrl ? (
                  <a
                    href={statement.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-brand/40 hover:text-brand"
                  >
                    Abrir
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={deletingId === statement.id}
                  onClick={() => void deleteStatement(statement)}
                  className="rounded-xl border border-red-500/15 bg-red-500/[0.07] px-3 py-2 text-xs font-semibold text-red-400 disabled:opacity-50"
                >
                  {deletingId === statement.id ? '…' : 'Eliminar'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 15h8M8 18h5" />
    </svg>
  )
}

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Bogota',
  })
    .format(new Date())
    .slice(0, 7)
}

function formatPeriod(value: string) {
  return new Date(`${value.slice(0, 7)}-15T12:00:00-05:00`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

function formatSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`
}

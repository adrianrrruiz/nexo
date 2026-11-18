'use client'

import { useRef, useState, useTransition } from 'react'
import type { InvestmentCurrency } from '@nexo/shared/types'
import { importPositions } from '@/app/(app)/inversiones/actions'
import { CSV_TEMPLATE, parseInvestmentImport } from '@/lib/investments/import'
import { MAX_IMPORT_BYTES } from '@/lib/investments/input'
import InvestmentDialog from './InvestmentDialog'
import { button, field, price, primary } from './presentation'

export default function ImportPositionsDialog({ onClose, onSaved }: {
  onClose: () => void
  onSaved: (message: string, refresh?: boolean) => void
}) {
  const [text, setText] = useState('')
  const [unit, setUnit] = useState<InvestmentCurrency>('USD')
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')
  const [reading, setReading] = useState(false)
  const latestRead = useRef(0)
  const [pending, startTransition] = useTransition()
  const preview = text ? parseInvestmentImport(text, unit) : null
  const valid = Boolean(preview?.positions.length) && !preview?.errors.length
  return (
    <InvestmentDialog title="Importar posiciones" onClose={onClose} busy={pending}>
      <p className="mb-3 text-sm leading-relaxed text-neutral-400">Selecciona un CSV de Yahoo Finance o de tu bróker, o un respaldo JSON de Mi Portafolio Claro. Podrás revisar los registros antes de guardarlos.</p>
      <div className="space-y-4">
        <a className={button} href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="plantilla-inversiones-nexo.csv">Descargar plantilla CSV</a>
        <label className="block space-y-1.5 text-sm">
          <span>Archivo CSV o JSON</span>
          <input
            type="file"
            className={`${field} file:mr-2 file:text-brand`}
            accept=".csv,.json,.tsv,text/csv,application/json,text/tab-separated-values"
            disabled={pending}
            onChange={async (event) => {
              const request = ++latestRead.current
              const file = event.target.files?.[0]
              setText('')
              setFilename(file?.name ?? '')
              setError('')
              setReading(false)
              if (!file) return
              if (file.size > MAX_IMPORT_BYTES) {
                setError('El archivo supera el límite de 512 KB.')
                return
              }
              setReading(true)
              try {
                const contents = await file.text()
                if (request !== latestRead.current) return
                setText(contents)
                if (!contents.trim()) setError('El archivo está vacío.')
              } catch {
                if (request === latestRead.current) setError('No se pudo leer el archivo.')
              } finally {
                if (request === latestRead.current) setReading(false)
              }
            }}
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span>Moneda para filas sin moneda</span>
          <select className={field} value={unit} disabled={pending}
            onChange={(event) => setUnit(event.target.value as InvestmentCurrency)}>
            <option value="USD">USD · Dólares</option><option value="COP">COP · Pesos colombianos</option>
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {reading && <p role="status" className="text-sm text-neutral-400">Leyendo archivo…</p>}
        {preview && (
          <>
            {preview.errors.length > 0 && (
              <ul aria-label="Errores del archivo" className="max-h-28 space-y-1 overflow-y-auto rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
                {preview.errors.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            )}
            {preview.positions.length > 0 && (
              <div className="rounded-xl border border-white/10">
                <p className="border-b border-white/10 p-3 text-sm font-semibold">{preview.positions.length} registros en {filename}</p>
                <ul aria-label="Vista previa de posiciones" className="max-h-48 divide-y divide-white/5 overflow-y-auto">
                  {preview.positions.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 break-words">{item.name}{item.symbol && item.symbol !== item.name && <small className="ml-1 text-neutral-400">{item.symbol}</small>}</span>
                      <span className="shrink-0 text-right tabular-nums text-neutral-400">{item.quantity} · {price(item.average_price, item.cost_currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!preview.errors.length && !preview.positions.length && <p className="text-sm text-neutral-400">El archivo no contiene posiciones para importar.</p>}
          </>
        )}
        <div className="flex justify-end">
          <button className={primary} type="button" disabled={!valid || pending || reading} onClick={() => {
            if (!preview || !valid) return
            setError('')
            startTransition(async () => {
              try {
                const result = await importPositions(preview.positions)
                if ('error' in result) setError(result.error)
                else onSaved(result.count ? `${result.count} posiciones importadas.` : 'Estas posiciones ya estaban importadas.', Boolean(result.count))
              } catch {
                setError('No se pudo conectar para confirmar la importación.')
              }
            })
          }}>{pending ? 'Importando…' : 'Confirmar importación'}</button>
        </div>
      </div>
    </InvestmentDialog>
  )
}

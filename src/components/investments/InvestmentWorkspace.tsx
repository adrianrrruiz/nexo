'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ASSET_LABELS, summarizePositions, valuePositions, type MarketSnapshot, type ValuedPosition } from '@nexo/shared/investments'
import type { InvestmentCurrency, InvestmentPosition } from '@nexo/shared/types'
import { refreshInvestmentQuotes, removeZeroPositions, saveInvestmentCurrency } from '@/app/(app)/inversiones/actions'
import ImportPositionsDialog from './ImportPositionsDialog'
import InvestmentAnalytics, { InvestmentGlossary, InvestmentSimulator } from './InvestmentAnalytics'
import InvestmentDialog from './InvestmentDialog'
import PositionEditor from './PositionEditor'
import { button, field, money, panel, percentage, price, primary, signColor, timestamp } from './presentation'

type AccountChoice = { id: string; name: string }
type Notice = { text: string; error?: boolean }
type Sort = 'value' | 'name' | 'quantity' | 'cost' | 'price' | 'return'
type Dialog = { type: 'editor'; position: ValuedPosition | null } | { type: 'import' | 'clear' }

const SORT_OPTIONS: Record<Sort, string> = {
  value: 'Valor actual', name: 'Nombre', quantity: 'Cantidad', cost: 'Costo total', price: 'Precio por unidad', return: 'Rentabilidad',
}
const quantityFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 8 })

export default function InvestmentWorkspace({ positions, market, currency, accounts }: {
  positions: InvestmentPosition[]
  market: MarketSnapshot
  currency: InvestmentCurrency
  accounts: AccountChoice[]
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [marketNotice, setMarketNotice] = useState<Notice | null>(null)
  const [sort, setSort] = useState<Sort>('value')
  const [refreshing, startRefresh] = useTransition()
  const [saving, startSave] = useTransition()
  const autoChecked = useRef(false)
  const marketBusy = useRef(false)
  const rows = valuePositions(positions, market, currency)
  const summary = summarizePositions(rows)
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const activeSymbols = positions.filter((p) => p.symbol !== null && p.quantity > 0)
  const marketPositionsKey = JSON.stringify(activeSymbols.map(({ id, symbol, quantity }) => [id, symbol, quantity]))
  const zeroCount = positions.filter((position) => position.quantity === 0).length

  const refresh = useCallback((reportSuccess = true) => {
    if (marketBusy.current) return
    marketBusy.current = true
    startRefresh(async () => {
      try {
        const result = await refreshInvestmentQuotes()
        if ('error' in result) setMarketNotice({ text: result.error, error: true })
        else if (!result.rate || result.updated !== result.expected) {
          setMarketNotice({
            text: `Yahoo actualizó ${result.updated} de ${result.expected} símbolos.${result.rate ? '' : ' La tasa USD/COP no se pudo actualizar.'} Nexo conserva los últimos datos disponibles.`,
            error: true,
          })
        } else setMarketNotice(reportSuccess ? { text: 'Precios y tasa actualizados.' } : null)
      } catch {
        setMarketNotice({ text: 'No se pudo conectar para actualizar los precios.', error: true })
      } finally {
        marketBusy.current = false
      }
    })
  }, [])

  useEffect(() => {
    if (!positions.length || autoChecked.current) return
    autoChecked.current = true
    const outdated = !market.checkedAt || Date.now() - Date.parse(market.checkedAt) > 20 * 60_000
    if (outdated) refresh(false)
  }, [positions.length, market.checkedAt, refresh])

  function onSaved(text: string, sync?: boolean) {
    autoChecked.current = true
    setDialog(null)
    setNotice({ text })
    if (sync) refresh(false)
  }

  const activeRows = [...rows].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es-CO')
    if (sort === 'name') return byName
    const key = sort === 'return' ? 'returnPct' : sort
    const left = a[key]
    const right = b[key]
    if (left === null && right === null) return byName
    if (left === null) return 1
    if (right === null) return -1
    return right - left || byName
  })

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link className="inline-flex min-h-8 items-center text-sm text-neutral-400 hover:text-brand" href="/dashboard">← Patrimonio</Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Inversiones</h1>
        </div>
        <fieldset className="inline-flex rounded-xl border border-white/10 bg-surface p-1" disabled={saving}>
          <legend className="sr-only">Moneda del portafolio</legend>
          {(['COP', 'USD'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={unit === currency}
              className={`min-h-10 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand ${unit === currency ? 'bg-brand/15 text-brand' : 'text-neutral-400 hover:text-white'}`}
              onClick={() => {
                if (unit === currency) return
                startSave(async () => {
                  try {
                    const result = await saveInvestmentCurrency(unit)
                    if ('error' in result) setNotice({ text: result.error, error: true })
                  } catch {
                    setNotice({ text: 'No se pudo guardar la moneda.', error: true })
                  }
                })
              }}
            >{unit}</button>
          ))}
        </fieldset>
      </header>

      <section aria-label="Resumen de inversiones" className="grid gap-3 sm:grid-cols-3">
        <div className={`${panel} border-brand/25 bg-linear-to-br from-brand/15 to-surface sm:row-span-1`}>
          <p className="text-sm font-medium text-neutral-300">{summary.priced < summary.active ? 'Valor disponible' : 'Valor del portafolio'}</p>
          <p className="mt-1 break-words text-3xl font-bold tracking-tight text-brand tabular-nums sm:text-4xl">{money(summary.total, currency)}</p>
          <p className="mt-2 text-xs text-neutral-400">{summary.priced} de {summary.active} posiciones activas valoradas</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <div className={`${panel} max-sm:p-3`}>
            <p className="text-sm text-neutral-400">{summary.knownCosts < summary.active ? 'Costo conocido' : 'Costo de las posiciones'}</p>
            <p className="mt-1 break-words text-[clamp(0.875rem,4.1vw,1.25rem)] font-semibold tracking-tight tabular-nums sm:text-2xl">{money(summary.cost, currency)}</p>
            <p className="mt-2 text-xs text-neutral-400">Costo de adquisición</p>
          </div>
          <div className={`${panel} max-sm:p-3`}>
            <p className="text-sm text-neutral-400">Ganancia o pérdida</p>
            <p className={`mt-1 break-words text-[clamp(0.875rem,4.1vw,1.25rem)] font-semibold tracking-tight tabular-nums sm:text-2xl ${signColor(summary.gain)}`}>{money(summary.gain, currency)}</p>
            <p className={`mt-2 text-xs ${signColor(summary.returnPct)}`}>{percentage(summary.returnPct, true)} · {summary.withCost} con precio y costo</p>
          </div>
        </div>
      </section>

      <section aria-label="Cotizaciones de mercado" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-surface px-4 py-3">
        <div className="min-w-0 flex-1 basis-52">
          <p className="text-sm font-medium text-neutral-200">
            {market.usdCop !== null ? `USD 1 = ${money(market.usdCop, 'COP')} COP` : 'Tasa USD/COP pendiente'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {market.rateAt ? `Tasa de Yahoo Finance · ${timestamp(market.rateAt)}` : 'Consulta los precios para obtener la tasa de Yahoo Finance.'}
          </p>
        </div>
        <button type="button" className={button} onClick={() => refresh()} disabled={refreshing}>
          {refreshing ? 'Actualizando…' : 'Actualizar cotizaciones'}
        </button>
        {marketNotice && <p role="status" className={`basis-full text-xs ${marketNotice.error ? 'text-amber-300' : 'text-brand'}`}>{marketNotice.text}</p>}
        {summary.priced < summary.active && <p className="basis-full text-xs text-amber-300">Faltan precios o tasas para algunas posiciones. Los importes muestran los valores disponibles.</p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {rows.length > 0 && <a href="#investment-positions" className="inline-flex min-h-11 items-center text-sm font-medium text-brand">Ver posiciones ↓</a>}
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={button} type="button" onClick={() => setDialog({ type: 'import' })}>Importar archivo</button>
          <button className={primary} type="button" onClick={() => setDialog({ type: 'editor', position: null })}>+ Agregar posición</button>
        </div>
      </div>

      <div className="space-y-4">
        <InvestmentAnalytics summary={summary} currency={currency} marketPositionsKey={activeSymbols.length ? marketPositionsKey : ''} />
      </div>

      <section className={panel} aria-labelledby="investment-positions">
        <h2 id="investment-positions" className="text-lg font-semibold">Posiciones</h2>
        {notice && <p role="status" className={`mt-3 text-sm ${notice.error ? 'text-red-300' : 'text-brand'}`}>{notice.text}</p>}
        {!rows.length ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-neutral-400">
            Aún no tienes posiciones. Agrega un activo o importa un archivo para empezar.
          </p>
        ) : (
          <>
            <div className="my-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                Ordenar por
                <select className={`min-h-10 !w-auto ${field}`} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  {Object.entries(SORT_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              {zeroCount > 0 && <button type="button" className={button} onClick={() => setDialog({ type: 'clear' })}>Quitar cantidad cero ({zeroCount})</button>}
            </div>

            <ul className="space-y-2 lg:hidden" aria-label="Posiciones">
              {activeRows.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => setDialog({ type: 'editor', position: row })}
                    className="w-full rounded-2xl border border-white/5 bg-ink p-3 text-left hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-brand">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3">
                      <span className="min-w-0"><PositionName row={row} accountName={row.account_id ? accountNames.get(row.account_id) : undefined} /></span>
                      <span className="text-right">
                        <span className="block break-words font-semibold tabular-nums">{money(row.value, currency)}</span>
                        <span className={`mt-0.5 block text-xs tabular-nums ${signColor(row.returnPct)}`}>{percentage(row.returnPct, true)}</span>
                      </span>
                    </div>
                    <span className="mt-2 block text-xs text-neutral-400">{quantityFormat.format(row.quantity)} {row.quantity === 1 ? 'unidad' : 'unidades'} · {price(row.price, currency)} por unidad</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table aria-label="Posiciones del portafolio" className="w-full min-w-[41rem] text-left text-sm">
                <thead className="text-xs text-neutral-400">
                  <tr className="border-b border-white/10">
                    <th scope="col" className="py-2 pr-3">Posición</th>
                    <th scope="col" className="px-3 py-2 text-right">Cantidad</th>
                    <th scope="col" className="px-3 py-2 text-right">Costo</th>
                    <th scope="col" className="px-3 py-2 text-right">Precio unitario</th>
                    <th scope="col" className="px-3 py-2 text-right">Valor</th>
                    <th scope="col" className="py-2 pl-3 text-right">Rendimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeRows.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[.025]">
                      <td className="max-w-52 py-3 pr-3">
                        <button type="button" onClick={() => setDialog({ type: 'editor', position: row })}
                          className="block w-full rounded text-left hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                          <PositionName row={row} accountName={row.account_id ? accountNames.get(row.account_id) : undefined} />
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 text-right tabular-nums">{quantityFormat.format(row.quantity)}</td>
                      <td className="whitespace-nowrap px-3 text-right tabular-nums">{money(row.cost, currency)}</td>
                      <td className="whitespace-nowrap px-3 text-right tabular-nums">
                        {price(row.price, currency)}
                        <span className="block text-xs text-neutral-400">{row.source === 'yahoo' ? 'Yahoo' : row.source === 'manual' ? 'Manual' : 'Pendiente'}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 text-right font-semibold tabular-nums">{money(row.value, currency)}</td>
                      <td className={`whitespace-nowrap pl-3 text-right tabular-nums ${signColor(row.gain)}`}>
                        {percentage(row.returnPct, true)}
                        <span className="block text-xs">{money(row.gain, currency)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <InvestmentSimulator key={currency} total={summary.total} currency={currency} />
      <InvestmentGlossary />

      {dialog?.type === 'editor' && <PositionEditor position={dialog.position} accounts={accounts} currency={currency} onClose={() => setDialog(null)} onSaved={onSaved} />}
      {dialog?.type === 'import' && <ImportPositionsDialog onClose={() => setDialog(null)} onSaved={onSaved} />}
      {dialog?.type === 'clear' && (
        <InvestmentDialog title="Quitar posiciones con cantidad cero" busy={saving} onClose={() => setDialog(null)}>
          <p className="mb-4 text-sm text-neutral-300">Se quitarán las posiciones que tengan cantidad cero al confirmar.</p>
          {notice?.error && <p role="alert" className="mb-3 text-sm text-red-300">{notice.text}</p>}
          <div className="flex justify-end gap-2">
            <button className={button} type="button" disabled={saving} onClick={() => setDialog(null)}>Cancelar</button>
            <button className={`${button} !border-red-400/40 !text-red-300`} type="button" disabled={saving} onClick={() => {
              startSave(async () => {
                try {
                  const result = await removeZeroPositions()
                  if ('error' in result) setNotice({ text: result.error, error: true })
                  else onSaved(result.count === 1 ? '1 posición eliminada.' : `${result.count} posiciones eliminadas.`)
                } catch {
                  setNotice({ text: 'No se pudieron quitar las posiciones.', error: true })
                }
              })
            }}>{saving ? 'Quitando…' : 'Confirmar eliminación'}</button>
          </div>
        </InvestmentDialog>
      )}
    </div>
  )
}

function PositionName({ row, accountName }: { row: ValuedPosition; accountName?: string }) {
  return <>
    <span className="block break-words font-semibold">{row.name}</span>
    <span className="mt-0.5 block break-words text-xs text-neutral-400">
      {[row.symbol && row.symbol !== row.name ? row.symbol : '', ASSET_LABELS[row.displayAssetType], accountName].filter(Boolean).join(' · ')}
    </span>
  </>
}

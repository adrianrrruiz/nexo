'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import { ASSET_LABELS, type ValuedPosition } from '@nexo/shared/investments'
import type { InvestmentAssetType, InvestmentCurrency, InvestmentPositionInput } from '@nexo/shared/types'
import { findInvestmentSymbols, removePosition, savePosition } from '@/app/(app)/inversiones/actions'
import { parseInvestmentNumber, positionSchema } from '@/lib/investments/input'
import type { MarketSearchResult } from '@/lib/investments/market'
import InvestmentDialog from './InvestmentDialog'
import { button, field, money, primary, timestamp } from './presentation'

type AccountChoice = { id: string; name: string }

export default function PositionEditor({ position, accounts, currency, onClose, onSaved }: {
  position: ValuedPosition | null
  accounts: AccountChoice[]
  currency: InvestmentCurrency
  onClose: () => void
  onSaved: (message: string, refresh?: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [name, setName] = useState(position?.name ?? '')
  const [symbol, setSymbol] = useState(position?.symbol ?? '')
  const [type, setType] = useState<InvestmentAssetType>(position?.asset_type ?? 'other')
  const [linkId, setLinkId] = useState(position?.account_id ?? '')
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<MarketSearchResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [touched, setTouched] = useState(false)
  const listId = useId()

  useEffect(() => {
    if (search.length < 2) return
    let canceled = false
    const timer = setTimeout(async () => {
      try {
        const response = await findInvestmentSymbols(search)
        if (canceled) return
        if ('error' in response) {
          setSearchError(response.error)
        } else {
          setSuggestions(response.results)
          setSearchError(response.results.length ? '' : 'Sin coincidencias. Puedes escribir el símbolo directamente.')
        }
      } catch {
        if (!canceled) setSearchError('La búsqueda está temporalmente fuera de servicio.')
      }
    }, 350)
    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [search])

  function submit(form: FormData) {
    const values = {
      name: name || symbol,
      symbol: symbol.trim() || null,
      asset_type: type,
      quantity: parseInvestmentNumber(String(form.get('quantity') ?? '')),
      average_price: parseInvestmentNumber(String(form.get('average_price') ?? '')),
      cost_currency: form.get('cost_currency'),
      manual_price: parseInvestmentNumber(String(form.get('manual_price') ?? '')),
      manual_currency: form.get('manual_currency'),
      account_id: linkId || null,
    }
    const parsed = positionSchema.safeParse(values)
    if (!parsed.success) {
      setMessage('Revisa el nombre, el símbolo y los valores numéricos. La cantidad debe ser cero o mayor.')
      return
    }
    setMessage('')
    startTransition(async () => {
      try {
        const result = await savePosition(parsed.data, position ? { id: position.id, updated_at: position.updated_at } : undefined)
        if ('error' in result) setMessage(result.error)
        else onSaved(position ? 'Cambios guardados.' : 'Posición agregada.', Boolean(parsed.data.symbol) || requiresRate(parsed.data))
      } catch {
        setMessage('No se pudo conectar para guardar. Inténtalo de nuevo.')
      }
    })
  }

  function clearSearch() {
    setSearch('')
    setSuggestions([])
    setSearchError('')
  }

  return (
    <InvestmentDialog title={position ? 'Detalle de la posición' : 'Agregar posición'} busy={pending} onClose={onClose}>
      {position && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-ink p-3 text-sm">
          <span className="text-neutral-400">Fuente del precio</span>
          <span>{position.source === 'yahoo' ? 'Yahoo Finance' : position.source === 'manual' ? 'Precio manual' : 'Pendiente'}</span>
          <span className="text-neutral-400">Fecha de cotización</span>
          <span>{timestamp(position.quote?.asOf ?? null)}</span>
          {position.quote?.change != null && <>
            <span className="text-neutral-400">Variación diaria</span>
            <span>{position.quote.change.toFixed(2)} %</span>
          </>}
        </div>
      )}
      <form onSubmit={(event) => {
        event.preventDefault()
        submit(new FormData(event.currentTarget))
      }} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="text-neutral-300">Símbolo o búsqueda en Yahoo Finance <span className="text-neutral-500">(opcional)</span></span>
            <input
              className={field}
              value={symbol}
              onChange={(event) => {
                setSymbol(event.target.value)
                clearSearch()
                setSearch(event.target.value.trim())
              }}
              onFocus={() => setTouched(true)}
              aria-describedby={touched && searchError ? listId : undefined}
              placeholder="AAPL, ICOLCAP.CL, BTC-USD…"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {touched && suggestions.length > 0 && (
            <ul aria-label="Símbolos encontrados" className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-ink">
              {suggestions.map((result) => (
                <li key={result.symbol} className="border-b border-white/5 last:border-0">
                  <button type="button" className="flex min-h-11 w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-white/5"
                    onClick={() => {
                      setSymbol(result.symbol)
                      if (!name.trim()) setName(result.name.slice(0, 120))
                      if (result.assetType) setType(result.assetType)
                      clearSearch()
                    }}>
                    <span className="text-sm font-semibold text-brand">{result.symbol} {result.exchange && <span className="text-xs font-normal text-neutral-400">· {result.exchange}</span>}</span>
                    <span className="text-xs text-neutral-300">{result.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {touched && searchError && <p id={listId} role="status" className="text-xs text-neutral-400">{searchError}</p>}
          <label className="block space-y-1.5 text-sm">
            <span className="text-neutral-300">Nombre de la posición</span>
            <input className={field} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required={!symbol.trim()} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 space-y-1.5 text-sm">
              <span className="text-neutral-300">Tipo de activo</span>
              <select className={field} value={type} onChange={(event) => setType(event.target.value as InvestmentAssetType)}>
                {Object.entries(ASSET_LABELS).map(([key, label]) => <option key={key} value={key}>{key === 'other' ? 'Otro / automático con Yahoo' : label}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-1.5 text-sm">
              <span className="text-neutral-300">Cantidad</span>
              <input className={field} name="quantity" inputMode="decimal" defaultValue={position?.quantity ?? ''} maxLength={24} required />
            </label>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="text-neutral-300">Precio medio por unidad</span>
              <input className={field} name="average_price" inputMode="decimal" defaultValue={position?.average_price ?? ''} placeholder="Opcional" maxLength={24} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-neutral-300">Moneda</span>
              <select className={field} name="cost_currency" aria-label="Moneda del precio medio" defaultValue={position?.cost_currency ?? currency}>
                <option value="COP">COP</option><option value="USD">USD</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-neutral-300">Precio manual por unidad</span>
              <input className={field} name="manual_price" inputMode="decimal" defaultValue={position?.manual_price ?? ''} placeholder="Opcional" maxLength={24} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-neutral-300">Moneda</span>
              <select className={field} name="manual_currency" aria-label="Moneda del precio manual" defaultValue={position?.manual_currency ?? currency}>
                <option value="COP">COP</option><option value="USD">USD</option>
              </select>
            </label>
          </div>
          {position?.quote?.currency === 'COP' && position.cost_currency === 'USD' && (
            <p className="text-xs text-neutral-400">Yahoo cotiza este activo en COP. Si registraste el precio medio en pesos, elige COP como moneda del costo.</p>
          )}
          <p className="text-xs text-neutral-400">Nexo usa el precio manual cuando la cotización de Yahoo no está disponible en tu moneda de consulta.</p>
          {((accounts.length > 0) || linkId) && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-neutral-300">Cuenta de Nexo vinculada</span>
              <select className={field} value={linkId} onChange={(event) => setLinkId(event.target.value)}>
                <option value="">Sin vincular</option>
                {linkId && !accounts.some((account) => account.id === linkId) && <option value={linkId} disabled>Cuenta no disponible</option>}
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <span className="block text-xs leading-relaxed text-neutral-400">
                Vincula solo una cuenta cuyo saldo ya represente estas inversiones. En Patrimonio, el valor de las posiciones reemplaza ese saldo cuando todas tienen valoración. Registra el efectivo en una posición aparte si forma parte del saldo.
              </span>
            </label>
          )}
          {position?.value != null && linkId && (
            <p className="text-xs text-neutral-400">Valor actual de esta posición para el desglose: {money(position.value, currency)}.</p>
          )}
        </fieldset>
        {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
        {confirmRemove ? (
          <div className="space-y-3 rounded-xl border border-red-400/30 p-3">
            <p className="text-sm">¿Eliminar {position?.name} del portafolio?</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={button} onClick={() => setConfirmRemove(false)} disabled={pending}>Cancelar</button>
              <button type="button" className={`${button} !border-red-400/40 !text-red-300`} disabled={pending}
                onClick={() => startTransition(async () => {
                  if (!position) return
                  try {
                    const result = await removePosition({ id: position.id, updated_at: position.updated_at })
                    if ('error' in result) setMessage(result.error)
                    else onSaved('Posición eliminada.')
                  } catch {
                    setMessage('No se pudo conectar para eliminar la posición.')
                  }
                })}>Confirmar eliminación</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {position && <button type="button" className={`${button} !text-red-300`} onClick={() => setConfirmRemove(true)} disabled={pending}>Eliminar</button>}
            <button className={`${primary} ml-auto`} type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar posición'}</button>
          </div>
        )}
      </form>
    </InvestmentDialog>
  )
}

function requiresRate(position: InvestmentPositionInput) {
  return (position.average_price !== null && position.cost_currency === 'USD') ||
    (position.manual_price !== null && position.manual_currency === 'USD')
}

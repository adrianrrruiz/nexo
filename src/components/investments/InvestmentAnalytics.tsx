'use client'

import { useEffect, useId, useState } from 'react'
import { ASSET_LABELS, historyStats, projectInvestment, summarizePositions } from '@nexo/shared/investments'
import type { InvestmentCurrency } from '@nexo/shared/types'
import { getInvestmentHistory } from '@/app/(app)/inversiones/actions'
import { MARKET_RANGES, parseInvestmentNumber, type MarketRange } from '@/lib/investments/input'
import type { HistoryPoint, PortfolioHistory } from '@/lib/investments/market'
import { button, field, money, panel, percentage, signColor } from './presentation'

const RANGE_LABELS: Record<MarketRange, string> = { '1m': '1 mes', '3m': '3 meses', '6m': '6 meses', '1y': '1 año', '5y': '5 años' }
const ALLOCATION_COLORS = ['#1dcd9f', '#168872', '#a1ead2', '#4a635e', '#628f83', '#d6e2dd', '#80928a']
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const intl = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

type Summary = ReturnType<typeof summarizePositions>

function Chart({ values, labels, currency, title }: {
  values: number[]
  labels: string[]
  currency: InvestmentCurrency
  title: string
}) {
  const gradient = useId()
  const [cursor, setCursor] = useState<number | null>(null)
  const selected = Math.min(cursor ?? values.length - 1, values.length - 1)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  const coords = values.map((value, i) =>
    [10 + i / Math.max(1, values.length - 1) * 580, span > 0 ? 145 - (value - minimum) / span * 126 : 82])
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const [selectedX, selectedY] = coords[selected]
  return (
    <figure className="min-w-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <figcaption className="text-xs text-neutral-400">{labels[selected]}</figcaption>
        <p className="text-sm font-semibold tabular-nums text-brand">{money(values[selected], currency)}</p>
      </div>
      <svg aria-hidden="true" viewBox="0 0 600 158" preserveAspectRatio="none" className="h-40 w-full sm:h-44">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1dcd9f" stopOpacity=".24" />
            <stop offset="100%" stopColor="#1dcd9f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 61, 103, 145].map((y) => <path key={y} d={`M10,${y} H590`} className="stroke-white/10" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />)}
        <path d={`${path} L${coords.at(-1)![0]},156 L10,156 Z`} fill={`url(#${gradient})`} />
        <path d={path} className="stroke-brand" strokeWidth="2" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={`M${selectedX},12 V150`} className="stroke-white/25" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        <circle cx={selectedX} cy={selectedY} r="4" className="fill-brand stroke-ink" strokeWidth="1.5" />
      </svg>
      <input
        className="block h-6 w-full accent-brand"
        type="range"
        min={0}
        max={values.length - 1}
        value={selected}
        onChange={(event) => setCursor(Number(event.target.value))}
        aria-label={title}
        aria-valuetext={`${labels[selected]}, ${money(values[selected], currency)}`}
      />
      <div className="flex justify-between gap-4 text-xs text-neutral-400"><span>{labels[0]}</span><span>{labels.at(-1)}</span></div>
    </figure>
  )
}

function Allocation({ summary, currency }: { summary: Summary; currency: InvestmentCurrency }) {
  const segments: string[] = []
  let offset = 0
  for (const [i, item] of summary.allocation.entries()) {
    const start = offset
    offset += item.percent
    segments.push(`${ALLOCATION_COLORS[i]} ${start}% ${Math.min(100, offset)}%`)
  }
  return (
    <section className={panel} aria-labelledby="investment-allocation">
      <h2 id="investment-allocation" className="text-base font-semibold">Distribución</h2>
      {summary.allocation.length ? (
        <div className="mt-5 grid items-center gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <div
            aria-hidden="true"
            className="mx-auto flex size-28 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${segments.join(',')})` }}
          >
            <div className="size-[4.5rem] rounded-full bg-surface" />
          </div>
          <ul className="space-y-2">
            {summary.allocation.map(({ type, value, percent }, i) => (
              <li key={type} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
                <span className="flex items-center gap-2 text-neutral-300"><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[i] }} />{ASSET_LABELS[type]}</span>
                <span className="font-semibold tabular-nums">{percentage(percent)}</span>
                <span className="col-start-2 text-right text-xs tabular-nums text-neutral-400">{money(value, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="mt-4 text-sm text-neutral-400">La distribución aparece cuando hay posiciones con valor.</p>}
    </section>
  )
}

type HistoryResponse = { key: string; history?: PortfolioHistory; error?: string }

export default function InvestmentAnalytics({ summary, currency, marketPositionsKey }: {
  summary: Summary
  currency: InvestmentCurrency
  marketPositionsKey: string
}) {
  const [range, setRange] = useState<MarketRange>('1y')
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<HistoryResponse | null>(null)
  const requestKey = `${currency}:${range}:${marketPositionsKey}:${attempt}`
  useEffect(() => {
    if (!marketPositionsKey) return
    let ignore = false
    void getInvestmentHistory(range, currency).then((result) => {
      if (!ignore) setResponse({ key: requestKey, ...result })
    }).catch(() => {
      if (!ignore) setResponse({ key: requestKey, error: 'No se pudo conectar para consultar el histórico.' })
    })
    return () => { ignore = true }
  }, [currency, marketPositionsKey, range, requestKey])

  const current = marketPositionsKey && response?.key === requestKey ? response : null
  const points: HistoryPoint[] = current?.history?.points ?? []
  const loading = Boolean(marketPositionsKey) && !current
  const statistics = historyStats(points.map((point) => point.value))

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(21rem,1fr)]">
        <section className={panel} aria-labelledby="investment-history">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="investment-history" className="text-base font-semibold">Evolución estimada</h2>
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              Rango
              <select className={`min-h-10 !w-auto ${field}`} value={range}
                onChange={(event) => setRange(event.target.value as MarketRange)}>
                {(Object.keys(MARKET_RANGES) as MarketRange[]).map((key) => <option key={key} value={key}>{RANGE_LABELS[key]}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 min-h-36" aria-busy={loading}>
            {points.length > 1 ? (
              <Chart key={requestKey} values={points.map((point) => point.value)}
                labels={points.map((point) => dateFormat.format(new Date(`${point.day}T12:00:00Z`)))}
                currency={currency} title="Consultar una fecha del gráfico" />
            ) : (
              <div className="grid min-h-36 place-content-center gap-2 rounded-2xl border border-dashed border-white/10 px-3 text-center text-sm text-neutral-400">
                <p role="status">{loading ? 'Consultando el histórico…'
                  : current?.error ?? (marketPositionsKey ? 'Yahoo Finance no devolvió suficientes precios para este rango.' : 'Agrega una posición con símbolo para ver su evolución.')}</p>
                {!loading && marketPositionsKey && <button type="button" className={button} onClick={() => setAttempt(attempt + 1)}>Reintentar</button>}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-neutral-400">
            Precios históricos de Yahoo Finance aplicados a las cantidades actuales, sin incorporar compras, ventas ni dividendos.
            {current?.history ? ` Cobertura: ${current.history.covered} de ${current.history.total} posiciones activas.` : ''}
          </p>
        </section>
        <Allocation summary={summary} currency={currency} />
      </div>
      <details className={panel}>
        <summary className="cursor-pointer font-semibold text-neutral-100">Salud del portafolio</summary>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric title="Riesgo por tipo de activo" value={summary.risk === null ? '—' : `${intl.format(summary.risk)} / 5`} />
          <Metric title="Diversificación estimada" value={summary.diversification === null ? '—' : `${summary.diversification} / 100`} />
          <Metric title="Mayor concentración" value={summary.topExposure ? percentage(summary.topExposure.percent) : '—'}
            note={summary.topExposure?.name} />
          <Metric title="Volatilidad anualizada" value={percentage(statistics.volatility)} />
          <Metric title="Caída máxima" value={percentage(statistics.drawdown)} />
          <Metric title="Ratio de Sharpe" value={statistics.sharpe === null ? '—' : intl.format(statistics.sharpe)} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">Riesgo y diversificación son estimaciones por composición. Volatilidad y Sharpe usan la serie visible y la convención de 252 sesiones al año, con tasa libre de riesgo de 0 % para Sharpe.</p>
      </details>
    </>
  )
}

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return <div className="min-w-0 rounded-2xl bg-ink p-3"><dt className="text-xs text-neutral-400">{title}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>{note && <dd className="mt-1 break-words text-xs text-neutral-400">{note}</dd>}</div>
}

export function InvestmentSimulator({ total, currency }: { total: number | null; currency: InvestmentCurrency }) {
  const [starting, setStarting] = useState('')
  const [monthly, setMonthly] = useState('0')
  const [annual, setAnnual] = useState('6')
  const [years, setYears] = useState('10')
  const initial = starting.trim() ? parseInvestmentNumber(starting) : total ?? 0
  const contribution = parseInvestmentNumber(monthly)
  const rate = Number(annual.replace(',', '.'))
  const term = Number(years)
  const result = initial !== null && Number.isFinite(initial) && initial <= 1e15
    && contribution !== null && Number.isFinite(contribution) && contribution <= 1e15
    && annual.trim() && Number.isFinite(rate) && rate >= -99 && rate <= 100
    && Number.isInteger(term) && term >= 1 && term <= 50
    ? projectInvestment(initial, contribution, rate, term) : null

  return (
    <details className={panel}>
      <summary className="cursor-pointer font-semibold">Simulador de crecimiento</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm"><span>Capital inicial ({currency})</span>
              <input inputMode="decimal" className={field} value={starting} onChange={(event) => setStarting(event.target.value)}
                placeholder={money(total ?? 0, currency)} maxLength={24} /></label>
            <label className="space-y-1 text-sm"><span>Aporte mensual ({currency})</span>
              <input inputMode="decimal" className={field} value={monthly} onChange={(event) => setMonthly(event.target.value)} maxLength={24} /></label>
            <label className="space-y-1 text-sm"><span>Rentabilidad anual (%)</span>
              <input inputMode="decimal" className={field} value={annual} onChange={(event) => setAnnual(event.target.value)} maxLength={8} /></label>
            <label className="space-y-1 text-sm"><span>Años</span>
              <input type="number" min={1} max={50} className={field} value={years} onChange={(event) => setYears(event.target.value)} /></label>
          </div>
          <p className="text-xs text-neutral-400">Capitalización mensual con aportes al final de cada mes. Escenario hipotético, sin impuestos, inflación ni comisiones.</p>
          {result ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-neutral-400">Total proyectado</dt><dd className="break-words text-right font-semibold text-brand">{money(result.value, currency)}</dd>
              <dt className="text-neutral-400">Capital y aportes</dt><dd className="break-words text-right">{money(result.contributed, currency)}</dd>
              <dt className="text-neutral-400">Crecimiento estimado</dt><dd className={`break-words text-right ${signColor(result.growth)}`}>{money(result.growth, currency)}</dd>
            </dl>
          ) : <p role="status" className="text-sm text-red-300">Usa valores válidos, de 1 a 50 años y una tasa entre −99 % y 100 %.</p>}
        </div>
        {result && (
          <Chart values={result.points} labels={result.points.map((_, i) => i === 0 ? 'Hoy' : `Año ${i}`)}
            currency={currency} title="Consultar un año de la proyección" />
        )}
      </div>
    </details>
  )
}

export function InvestmentGlossary() {
  const entries = [
    ['Precio medio', 'Costo promedio de una unidad, en la moneda que indicaste para el costo.'],
    ['Rentabilidad', 'Ganancia o pérdida sin realizar dividida entre el costo de las posiciones comparables.'],
    ['Concentración', 'Porcentaje del valor del portafolio que corresponde a la posición de mayor peso. Se agrupan los lotes del mismo símbolo.'],
    ['Volatilidad', 'Medida de cuánto variaron los resultados de la serie histórica.'],
    ['Caída máxima', 'Mayor descenso porcentual desde un máximo previo en la serie visible.'],
    ['Ratio de Sharpe', 'Rendimiento medio por unidad de volatilidad. Nexo usa una tasa de referencia de 0 %.'],
    ['ETF', 'Fondo que se negocia en bolsa, normalmente compuesto por varios activos.'],
  ]
  return (
    <details className={panel}>
      <summary className="cursor-pointer font-semibold">Glosario de inversiones</summary>
      <dl className="mt-4 space-y-3 text-sm">
        {entries.map(([term, meaning]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-0.5 text-neutral-400">{meaning}</dd></div>)}
      </dl>
    </details>
  )
}

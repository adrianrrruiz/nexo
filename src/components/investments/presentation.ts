import type { InvestmentCurrency } from '@nexo/shared/types'

const monetary = {
  COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 8 })
const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })

export function money(value: number | null, currency: InvestmentCurrency) {
  return value === null ? '—' : monetary[currency].format(value)
}

export function price(value: number | null, currency: InvestmentCurrency) {
  if (value === null) return '—'
  return value > 0 && value < 0.01 ? `${currency} ${decimal.format(value)}` : money(value, currency)
}

export function percentage(value: number | null, signed = false) {
  return value === null ? '—' : `${signed && value > 0 ? '+' : ''}${percent.format(value)} %`
}

export function signColor(value: number | null) {
  return value === null || value === 0 ? 'text-neutral-300' : value < 0 ? 'text-red-400' : 'text-brand'
}

export function timestamp(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : '—'
}

export const panel = 'min-w-0 rounded-3xl border border-white/10 bg-surface p-4 sm:p-5'
export const field = 'w-full min-w-0 rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-base text-neutral-100 outline-none focus:border-brand sm:text-sm'
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45'
export const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-ink hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45'

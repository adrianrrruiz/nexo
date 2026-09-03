import { formatDateInputValue } from '@/lib/format'
import type { Category, SubscriptionFrequency } from '@/lib/supabase/types'

export const FREQUENCY_LABEL: Record<SubscriptionFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  bimonthly: 'Cada 2 meses',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  yearly: 'Anual',
}

export const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as SubscriptionFrequency[]

/** Meses que avanza cada periodo. `weekly` se maneja aparte, en días. */
const MONTHS_PER_PERIOD: Record<SubscriptionFrequency, number> = {
  weekly: 0,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
}

export function isSubscriptionFrequency(value: string): value is SubscriptionFrequency {
  return value in FREQUENCY_LABEL
}

/** Fecha de hoy (YYYY-MM-DD) en zona Colombia. */
export function todayInBogota(now = new Date()): string {
  return formatDateInputValue(now)
}

function toUtcParts(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/**
 * Siguiente cobro después de `current`. El día del mes se ancla al del primer
 * cobro (`startedOn`), así un cargo del 31 no se queda pegado en el 28 después
 * de pasar por febrero. Si el mes destino es más corto, se usa su último día.
 */
export function advanceChargeDate(
  current: string,
  frequency: SubscriptionFrequency,
  startedOn: string
): string {
  const { year, month, day } = toUtcParts(current)

  if (frequency === 'weekly') {
    return toIsoDate(new Date(Date.UTC(year, month - 1, day + 7)))
  }

  const anchorDay = toUtcParts(startedOn).day
  const target = new Date(Date.UTC(year, month - 1 + MONTHS_PER_PERIOD[frequency], 1))
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(anchorDay, daysInTargetMonth))
  return toIsoDate(target)
}

/** Días entre dos fechas YYYY-MM-DD (positivo si `to` es posterior). */
export function daysBetween(from: string, to: string): number {
  const a = toUtcParts(from)
  const b = toUtcParts(to)
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}

/** Una suscripción está pendiente cuando su próximo cobro ya llegó. */
export function isDue(nextChargeOn: string, today = todayInBogota()): boolean {
  return nextChargeOn <= today
}

/** Texto humano del vencimiento: "Hoy", "Hace 3 días", "En 5 días". */
export function describeDueDate(nextChargeOn: string, today = todayInBogota()): string {
  const days = daysBetween(today, nextChargeOn)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days === -1) return 'Ayer'
  if (days < 0) return `Hace ${-days} días`
  return `En ${days} días`
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
}

/**
 * Categoría que se preselecciona al crear una suscripción: la del usuario
 * llamada "Suscripciones" (o similar). `null` si todavía no la tiene creada.
 */
export function findSubscriptionCategoryId(
  categories: Pick<Category, 'id' | 'name' | 'kind'>[]
): string | null {
  const match = categories.find(
    (category) =>
      category.kind === 'expense' && normalize(category.name).startsWith('suscripc')
  )
  return match?.id ?? null
}

/** Costo mensual equivalente, para comparar suscripciones de distinta frecuencia. */
export function monthlyEquivalent(
  amount: number,
  frequency: SubscriptionFrequency
): number {
  if (frequency === 'weekly') return (amount * 52) / 12
  return amount / MONTHS_PER_PERIOD[frequency]
}

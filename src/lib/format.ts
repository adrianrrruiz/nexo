const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatea un monto en pesos colombianos con centavos fijos. */
export function formatCOP(value: number): string {
  return COP.format(value)
}

const COP_NUMBER = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatea centavos escritos de derecha a izquierda para inputs monetarios. */
export function formatCOPFromCents(centsText: string): string {
  const cents = Number(centsText || '0')
  return `$ ${COP_NUMBER.format(cents / 100)}`
}

/** Fecha corta legible: "10 jul". */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  })
}

/** Valor YYYY-MM-DD para inputs de fecha, en zona Colombia. */
export function formatDateInputValue(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  })
}

/** Fecha larga legible: "7 de julio de 2026". */
export function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00-05:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

/** Rango del mes actual en ISO (para consultas). */
export function currentMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'numeric',
    timeZone: 'America/Bogota',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const monthIndex = Number(parts.find((part) => part.type === 'month')?.value) - 1
  // Colombia permanece en UTC-5. Las 05:00 UTC corresponden a medianoche local.
  const start = new Date(Date.UTC(year, monthIndex, 1, 5))
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 5))
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Etiqueta de mes legible: "julio de 2026". */
export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

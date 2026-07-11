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

/** Rango del mes actual en ISO (para consultas). */
export function currentMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
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

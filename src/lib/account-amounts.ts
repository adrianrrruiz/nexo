/** Acepta montos decimales del formulario y montos escritos en formato colombiano. */
export function parseAccountAmount(value: string): number {
  const raw = value.trim().replace(/[$\s]/g, '')
  if (!raw) return 0
  if (/^-?\d+(\.\d{1,2})?$/.test(raw)) return Number(raw)
  if (/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(raw) || /^-?\d+(,\d{1,2})?$/.test(raw)) {
    return Number(raw.replaceAll('.', '').replace(',', '.'))
  }
  return NaN
}

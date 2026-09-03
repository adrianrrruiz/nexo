'use client'

import { formatCOPFromCents } from '@/lib/format'

const FIELD =
  'w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-base outline-none focus:border-brand/60'

/**
 * Campo monetario que se escribe de derecha a izquierda: cada dígito entra por
 * los centavos. `value` son los centavos como texto; el valor enviado en el
 * formulario es el monto decimal.
 */
export default function AmountField({
  name,
  value,
  onChange,
  label = 'Monto',
}: {
  name: string
  value: string
  onChange: (cents: string) => void
  label?: string
}) {
  const stripLeadingZeros = (digits: string) => digits.replace(/^0+(?=\d)/, '')

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value ? (Number(value) / 100).toFixed(2) : ''}
      />
      <input
        type="text"
        inputMode="numeric"
        required
        aria-label={label}
        placeholder="$ 0,00"
        value={value ? formatCOPFromCents(value) : ''}
        onKeyDown={(event) => {
          if (/^\d$/.test(event.key)) {
            event.preventDefault()
            const hasSelection =
              event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
            onChange(stripLeadingZeros(`${hasSelection ? '' : value}${event.key}`))
            return
          }
          if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            const hasSelection =
              event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
            onChange(hasSelection ? '' : value.slice(0, -1))
          }
        }}
        onChange={(event) => {
          onChange(stripLeadingZeros(event.target.value.replace(/\D/g, '')))
        }}
        onPaste={(event) => {
          event.preventDefault()
          onChange(
            stripLeadingZeros(event.clipboardData.getData('text').replace(/\D/g, ''))
          )
        }}
        className={`${FIELD} text-lg font-semibold`}
      />
    </>
  )
}

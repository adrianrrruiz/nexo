/**
 * Logo de Nexo: la "N" de cinta con el punto verde, en SVG vectorial.
 * `id` debe ser único si se renderiza más de una vez en la misma página.
 */
export default function Logo({
  className = 'h-10 w-10',
  id = 'nexo-logo',
}: {
  className?: string
  id?: string
}) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1DCD9F" />
          <stop offset="100%" stopColor="#169976" />
        </linearGradient>
      </defs>
      <path
        d="M18 80 V28 L66 80 V38"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="13" r="9" fill="#1DCD9F" />
    </svg>
  )
}

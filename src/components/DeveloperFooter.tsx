import Link from 'next/link'

export default function DeveloperFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-white/[0.06] pt-6 text-center ${className}`}>
      <p className="text-xs text-neutral-500">Desarrollado por Adrian Ruiz</p>
      <div className="mt-3 flex justify-center gap-3">
        <SocialLink href="https://github.com/adrianrrruiz" label="GitHub">
          <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9v2.81c0 .27.18.59.69.49A10.14 10.14 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
        </SocialLink>
        <SocialLink
          href="https://www.linkedin.com/in/adrian-ruiz-33863323a/"
          label="LinkedIn"
        >
          <path d="M6.94 8.86H3.8V19h3.14V8.86ZM5.37 4a1.82 1.82 0 1 0 0 3.64 1.82 1.82 0 0 0 0-3.64Zm13.82 9.3c0-3.05-1.63-4.47-3.8-4.47a3.28 3.28 0 0 0-2.96 1.63h-.04v-1.6h-3V19h3.13v-5.02c0-1.32.25-2.6 1.89-2.6 1.61 0 1.63 1.51 1.63 2.68V19h3.14v-5.7Z" />
        </SocialLink>
      </div>
    </footer>
  )
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition-colors hover:border-brand/40 hover:text-brand"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        {children}
      </svg>
    </Link>
  )
}

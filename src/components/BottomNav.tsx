'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: (
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z" />
    ),
  },
  {
    href: '/movimientos',
    label: 'Movimientos',
    icon: (
      <>
        <path d="M7 4v13" />
        <path d="m3.5 13.5 3.5 3.5 3.5-3.5" />
        <path d="M17 20V7" />
        <path d="m13.5 10.5 3.5-3.5 3.5 3.5" />
      </>
    ),
  },
  {
    href: '/cuentas',
    label: 'Cuentas',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M3 10.5h18" />
      </>
    ),
  },
  {
    href: '/perfil',
    label: 'Perfil',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20.5c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5" />
      </>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-6">
      <div className="relative flex w-fit items-center justify-center gap-1 overflow-hidden rounded-full border border-white/20 bg-white/[0.08] px-2 py-2 shadow-[0_18px_55px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/35" />
        <div className="pointer-events-none absolute -left-8 top-0 h-16 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-0 h-16 w-24 rounded-full bg-brand/10 blur-2xl" />
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? 'bg-white/[0.13] text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                  : 'text-neutral-400 hover:text-neutral-100'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {item.icon}
              </svg>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

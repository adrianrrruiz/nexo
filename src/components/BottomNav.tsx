'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/Logo'

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
  const activeIndex = pathname.startsWith('/categorias')
    ? ITEMS.findIndex((item) => item.href === '/cuentas')
    : ITEMS.findIndex((item) => pathname.startsWith(item.href))
  const currentIndex = activeIndex === -1 ? 0 : activeIndex

  return (
    <>
      <aside className="sticky top-0 hidden h-[calc(100vh-env(safe-area-inset-top))] flex-col border-r border-white/[0.06] bg-surface/60 px-5 py-7 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3 px-2">
          <Logo className="h-10 w-10" id="nexo-logo-sidebar" />
          <div>
            <p className="text-base font-semibold tracking-tight">Nexo</p>
            <p className="text-[11px] text-neutral-500">Finanzas personales</p>
          </div>
        </Link>
        <nav aria-label="Navegación principal" className="space-y-1.5">
          {ITEMS.map((item, index) => (
            <NavLink key={item.href} item={item} active={index === currentIndex} desktop />
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs leading-5 text-neutral-600">
          Tus números, siempre a la vista.
        </p>
      </aside>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-6 lg:hidden"
      >
        <div className="relative overflow-hidden rounded-full border border-white/20 bg-white/[0.08] px-2 py-2 shadow-[0_18px_55px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150">
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/35" />
          <div className="pointer-events-none absolute -left-8 top-0 h-16 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -right-8 bottom-0 h-16 w-24 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative grid grid-cols-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1/4 p-1 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${currentIndex * 100}%)` }}
            >
              <div className="h-full w-full rounded-full bg-white/[0.13] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />
            </div>
            {ITEMS.map((item, index) => (
              <NavLink key={item.href} item={item} active={index === currentIndex} />
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}

function NavLink({
  item,
  active,
  desktop = false,
}: {
  item: (typeof ITEMS)[number]
  active: boolean
  desktop?: boolean
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={
        desktop
          ? `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
              active
                ? 'bg-brand/[0.12] text-brand shadow-[inset_0_0_0_1px_rgba(29,205,159,0.16)]'
                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100'
            }`
          : `relative z-10 flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors duration-200 ${
              active ? 'text-brand' : 'text-neutral-400 hover:text-neutral-100'
            }`
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={`${desktop ? 'h-5 w-5' : 'h-5 w-5'} transition-transform duration-200 ${
          active && !desktop ? 'scale-110' : 'scale-100'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {item.icon}
      </svg>
      <span className={desktop ? '' : 'text-[10px] font-medium'}>{item.label}</span>
    </Link>
  )
}

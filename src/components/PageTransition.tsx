'use client'

import { usePathname } from 'next/navigation'

/**
 * Anima suavemente la entrada del contenido en cada cambio de ruta. Al usar el
 * pathname como `key`, el subárbol se vuelve a montar y reproduce la animación
 * `page-enter` (fade + leve desplazamiento), para que la transición entre
 * secciones no se sienta brusca.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}

/**
 * Fallback de carga para las secciones de la app. Sirve dos propósitos:
 *  - Habilita el streaming del shell (con el SplashScreen) en el arranque en
 *    frío, en vez de una pantalla negra hasta que llegan los datos.
 *  - Da una señal de carga discreta al cambiar entre pestañas del navbar.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <span
        role="status"
        aria-label="Cargando"
        className="app-spinner"
      />
    </div>
  )
}

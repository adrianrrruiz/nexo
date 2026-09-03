/**
 * Abre el selector nativo de un input de fecha/mes/hora.
 *
 * Los navegadores de escritorio solo lo abren solos cuando el clic cae justo
 * sobre el icono del propio input; tocar el resto del campo únicamente enfoca
 * un segmento de texto. `showPicker()` exige un gesto del usuario, así que hay
 * que llamarlo desde el manejador del evento, nunca desde un efecto.
 */
export function openNativePicker(input: HTMLInputElement) {
  if (typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // Navegadores sin soporte o sin permiso: queda el comportamiento nativo.
  }
}

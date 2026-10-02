import type { Category } from '@/lib/supabase/types'

// Catálogo inicial compartido por la pantalla y el servidor. Los nombres,
// iconos y tipos guardados siempre se resuelven aquí, no desde el formulario.
export const DEFAULT_CATEGORY_SUGGESTIONS: Pick<Category, 'id' | 'name' | 'kind' | 'color' | 'icon'>[] = [
  ['market', 'Mercado', '🛒'],
  ['restaurants', 'Restaurantes', '🍴'],
  ['rent', 'Arriendo', '🏠'],
  ['utilities', 'Servicios', '⚡'],
  ['subscriptions', 'Suscripciones', '🔁'],
  ['clothes', 'Ropa', '👕'],
  ['entertainment', 'Entretenimiento', '🎮'],
  ['health', 'Salud', '🩺'],
  ['education', 'Educación', '🎓'],
  ['personal-care', 'Cuidado personal', '✨'],
  ['transport', 'Transporte', '🚙'],
  ['fuel', 'Combustible', '⛽'],
  ['pets', 'Mascotas', '🐾'],
  ['travel', 'Viajes', '✈️'],
  ['gifts', 'Regalos', '🎁'],
  ['other-expenses', 'Otros gastos', '🧾'],
  ['salary', 'Salario', '💼'],
  ['freelance', 'Honorarios', '💻'],
  ['business', 'Negocio', '🏪'],
  ['investments', 'Inversiones', '📈'],
  ['sales', 'Ventas', '🏷️'],
  ['other-income', 'Otros ingresos', '💰'],
].map(([id, name, icon], index) => ({
  id: `starter-${id}`,
  name,
  icon,
  kind: index < 16 ? 'expense' : 'income',
  color: null,
}))

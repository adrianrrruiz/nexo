import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
export type ActionContext = {
  createClient: () =>
    | SupabaseClient<Database>
    | Promise<SupabaseClient<Database>>
  revalidatePath: (path: string) => void
}
export type Fields = {
  get: (name: string) => unknown
  getAll: (name: string) => unknown[]
  has: (name: string) => boolean
}

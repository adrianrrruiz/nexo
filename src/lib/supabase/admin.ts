import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

let adminClient: SupabaseClient<Database> | null = null

export function createAdminClient() {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !secret) {
    throw new Error('Supabase server credentials are not configured.')
  }

  adminClient = createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  return adminClient
}

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Singleton browser client. Multiple instances race on the same cookie
 * storage (one tab/instance can overwrite or clear the session another
 * just wrote), which surfaces as "login does not persist". A single
 * shared instance per page load is the world-standard fix.
 */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClient
}

/** Test seam: reset the singleton between tests. */
export function resetBrowserClient(): void {
  browserClient = null
}

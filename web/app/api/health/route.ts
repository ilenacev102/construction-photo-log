import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public liveness probe for monitors and load balancers.
 * Reports database + storage reachability without leaking internals.
 */
export async function GET() {
  const started = Date.now()
  try {
    const admin = createAdminClient()
    const [{ error: dbError }, { error: storageError }] = await Promise.all([
      admin.from('projects').select('id', { count: 'exact', head: true }),
      admin.storage.from('construction-photos').list('', { limit: 1 }),
    ])
    const ok = !dbError && !storageError
    return NextResponse.json(
      {
        ok,
        db: !dbError,
        storage: !storageError,
        latencyMs: Date.now() - started,
      },
      { status: ok ? 200 : 503 },
    )
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}

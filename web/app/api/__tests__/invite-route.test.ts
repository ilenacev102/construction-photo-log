import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/invite/route'

/**
 * Cross-company invitation flow on POST /api/invite.
 *
 * Plan/seat enforcement (P1-3, HTTP 402) was removed together with the
 * subscription system — invites are unlimited now. These tests lock the
 * surviving authorization rules: role gating and the cross-company
 * restriction, plus that the grant upsert still runs.
 */
const { INVITER_ID, PROJECT_ID, TARGET_ID, OWNER_ID, dbHandlers, makeDb, ok } = vi.hoisted(() => {
  type RowResult = { data: unknown; error: unknown }

  const INVITER_ID = 'inviter-1'
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
  const TARGET_ID = '22222222-2222-4222-8222-222222222222'
  const OWNER_ID = 'owner-1'

  const dbHandlers: Record<string, () => RowResult> = {}
  const call = (key: string) => dbHandlers[key]?.() ?? { data: null, error: null }

  /**
   * Minimal fluent mock of the Supabase query builder used by the invite
   * route. Every chained call returns the same thenable chain; the terminal
   * decides the handler key:
   *   .single() -> `${table}.single[:<eq id>]`  (eq('id', x) disambiguates
   *                the three profiles.single calls: inviter / owner / target)
   */
  const makeDb = () => {
    const db = {
      from: (_table: string) => {
        let eqId: string | null = null
        const chain = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            if (col === 'id') eqId = String(val)
            return chain
          },
          in: () => chain,
          upsert: () => chain,
          single: () => call(`${_table}.single${eqId ? `:${eqId}` : ''}`),
          maybeSingle: () => call(`${_table}.maybeSingle`),
          then: (resolve: (v: RowResult) => void) => resolve(call(`${_table}.chain`)),
        }
        return chain
      },
    }
    return db
  }

  const ok = (data: unknown): RowResult => ({ data, error: null })
  return { INVITER_ID, PROJECT_ID, TARGET_ID, OWNER_ID, dbHandlers, makeDb, ok }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: INVITER_ID } },
        error: null,
      })),
    },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => makeDb()),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}))

function inviteRequest(projectId: string, targetUserId: string): NextRequest {
  return new NextRequest('http://localhost/api/invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'inviteUser', projectId, targetUserId }),
  })
}

function seedHappyPath(inviterRole: string): void {
  dbHandlers[`profiles.single:${INVITER_ID}`] = () =>
    ok({ company_name: 'Acme', role: inviterRole })
  dbHandlers[`projects.single:${PROJECT_ID}`] = () => ok({ user_id: OWNER_ID })
  dbHandlers[`profiles.single:${OWNER_ID}`] = () => ok({ company_name: 'Acme' })
  dbHandlers[`profiles.single:${TARGET_ID}`] = () =>
    ok({ company_name: 'Rival', full_name: 'Bob', role: 'worker' })
  dbHandlers['user_permissions.single'] = () =>
    ok({
      user_id: TARGET_ID,
      permission_key: `project.VIEW.${PROJECT_ID}`,
      granted: true,
    })
}

describe('POST /api/invite inviteUser', () => {
  beforeEach(() => {
    for (const key of Object.keys(dbHandlers)) delete dbHandlers[key]
  })

  it('grants cross-company access with no seat limit (upsert runs, 200)', async () => {
    // No subscriptions/count handlers are seeded — the route must not query them.
    seedHappyPath('site_manager')

    const res = await POST(inviteRequest(PROJECT_ID, TARGET_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.targetName).toBe('Bob')
    expect(body.data.granted).toBe(true)
  })

  it('rejects targets from the same company with 400', async () => {
    seedHappyPath('site_manager')
    dbHandlers[`profiles.single:${TARGET_ID}`] = () =>
      ok({ company_name: 'Acme', full_name: 'Colleague', role: 'worker' })

    const res = await POST(inviteRequest(PROJECT_ID, TARGET_ID))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('компанија')
  })

  it('rejects inviters who are neither site_manager nor admin (403)', async () => {
    dbHandlers[`profiles.single:${INVITER_ID}`] = () =>
      ok({ company_name: 'Acme', role: 'worker' })

    const res = await POST(inviteRequest(PROJECT_ID, TARGET_ID))

    expect(res.status).toBe(403)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../audit-logs/route'

const USER_ID = 'user-1'

const { getUserMock, createClientMock, createAdminClientMock, getCompanyContextMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    getCompanyContextMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/company-auth', () => ({
  getCompanyContext: getCompanyContextMock,
  requireProjectAccess: vi.fn(),
}))

type RowResult = { data: unknown; error: unknown }

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/**
 * Minimal fluent mock of the Supabase query builder used by audit-logs GET.
 * `.single()` resolves via the `${table}.single` handler; an awaited chain
 * (no terminal) resolves via the `${table}.chain` handler. `.in` is a spy so
 * tests can assert the company filter was applied.
 */
function makeAdminDb(handlers: Record<string, () => RowResult>) {
  const inSpy = vi.fn()
  const call = (key: string) => handlers[key]?.() ?? { data: null, error: null }
  const db = {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: (...args: unknown[]) => {
          inSpy(...args)
          return chain
        },
        order: () => chain,
        range: () => chain,
        ilike: () => chain,
        single: () => call(`${table}.single`),
        then: (resolve: (v: RowResult) => void) => resolve(call(`${table}.chain`)),
      }
      return chain
    },
  }
  return { db, inSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
})

describe('GET /api/audit-logs (P2-3: no cross-company leak for company-less site_manager)', () => {
  it('returns an empty list when a site_manager has no company context', async () => {
    getCompanyContextMock.mockResolvedValue(null)
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'profiles.single': () => ok({ role: 'site_manager' }),
        // Foreign-company rows the unscoped query would leak today.
        'audit_logs.chain': () => ok([{ id: 'log-1', user_id: 'foreign-user' }]),
      }).db,
    )

    const res = await GET(new NextRequest('http://localhost/api/audit-logs'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [], error: null })
  })

  it('still applies the company user filter for a site_manager with a company', async () => {
    const companyUserIds = [USER_ID, 'user-2']
    getCompanyContextMock.mockResolvedValue({
      companyName: 'Acme',
      companyUserIds,
      isAdmin: false,
    })
    const { db, inSpy } = makeAdminDb({
      'profiles.single': () => ok({ role: 'site_manager' }),
      'audit_logs.chain': () => ok([{ id: 'log-1', user_id: USER_ID }]),
    })
    createAdminClientMock.mockReturnValue(db)

    const res = await GET(new NextRequest('http://localhost/api/audit-logs'))

    expect(inSpy).toHaveBeenCalledWith('user_id', companyUserIds)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [{ id: 'log-1', user_id: USER_ID }],
      error: null,
    })
  })
})
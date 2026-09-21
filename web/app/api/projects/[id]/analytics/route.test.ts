import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import {
  GET,
  computeAnalyticsSummary,
  computeEvidenceStats,
  buildRiskInput,
  isManagerRole,
} from './route'
import { todayStartInTz } from '@/lib/time'

const USER_ID = 'user-1'
const PROJECT_ID = 'p1'

// ============================================================================
// Route-level tests (auth, role-scoped contract, KPIs)
// ============================================================================

const {
  getUserMock,
  createClientMock,
  createAdminClientMock,
  requireProjectAccessMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireProjectAccessMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectAccess: requireProjectAccessMock,
}))

type RowResult = { data: unknown; error: unknown }

type DbHandler = Mock<(...args: unknown[]) => RowResult>

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/**
 * Minimal fluent mock of the Supabase query builder used by the analytics
 * route. `.single()` / `.maybeSingle()` resolve via the `${table}.single` /
 * `${table}.maybeSingle` handler; an awaited chain without a terminal resolves
 * via the `${table}.chain` handler.
 */
function makeAdminDb() {
  const handlers = new Map<string, DbHandler>()

  const handlerFor = (key: string): DbHandler => {
    let fn = handlers.get(key)
    if (!fn) {
      fn = vi.fn(() => ok(null))
      handlers.set(key, fn)
    }
    return fn
  }

  const buildChain = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: () => handlerFor(`${table}.single`)(),
      maybeSingle: () => handlerFor(`${table}.maybeSingle`)(),
      then: (resolve: (v: RowResult) => void) => resolve(handlerFor(`${table}.chain`)()),
    }
    return chain
  }

  return {
    db: { from: (table: string) => buildChain(table) },
    handlerFor,
    handlers,
  }
}

/**
 * Fixture data (all timestamps deterministic) for a project whose tz is
 * Europe/Skopje and whose "today" (fake clock) is 2026-08-14 12:00 UTC.
 */
function managerDb() {
  const { db, handlerFor, handlers } = makeAdminDb()
  handlerFor('projects.single').mockResolvedValue(
    ok({ timezone: 'Europe/Skopje', user_id: USER_ID }),
  )
  handlerFor('profiles.maybeSingle').mockResolvedValue(ok({ role: 'site_manager' }))
  handlerFor('photos.chain').mockResolvedValue(
    ok([
      { taken_at: '2026-08-12T09:00:00Z', created_at: '2026-08-12T09:00:00Z' },
      { taken_at: '2026-08-12T15:00:00Z', created_at: '2026-08-12T15:00:00Z' },
      { taken_at: '2026-08-01T09:00:00Z', created_at: '2026-08-01T09:00:00Z' },
    ]),
  )
  handlerFor('defects.chain').mockResolvedValue(
    ok([
      { severity: 'high', status: 'open', due_date: '2026-08-10', created_at: '2026-08-01T09:00:00Z' },
      { severity: 'low', status: 'resolved', due_date: null, created_at: '2026-07-20T09:00:00Z' },
    ]),
  )
  handlerFor('work_orders.chain').mockResolvedValue(
    ok([
      { status: 'pending', due_date: '2026-08-09' },
      { status: 'done', due_date: '2026-08-01' },
    ]),
  )
  handlerFor('daily_logs.chain').mockResolvedValue(
    ok([{ created_at: '2026-08-13T10:00:00Z' }]),
  )
  handlerFor('attendance_logs.chain').mockResolvedValue(
    ok([{ check_in: '2026-08-14T08:00:00Z' }]),
  )
  return { db, handlerFor, handlers }
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
  requireProjectAccessMock.mockResolvedValue({ ctx: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/projects/[id]/analytics', () => {
  const url = `http://localhost/api/projects/${PROJECT_ID}/analytics`
  const call = (): Promise<Response> =>
    GET(new NextRequest(url), { params: Promise.resolve({ id: PROJECT_ID }) })

  it('returns 401 when unauthenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const res = await call()

    expect(res.status).toBe(401)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ data: null, error: expect.any(String) })
  })

  it('returns 403 when the caller lacks project access', async () => {
    const { db } = makeAdminDb()
    createAdminClientMock.mockReturnValue(db)
    requireProjectAccessMock.mockRejectedValue(
      Object.assign(new Error('Немате пристап до овој проект'), { status: 403 }),
    )

    const res = await call()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ data: null, error: expect.any(String) })
  })

  it('enforces project access before any data query', async () => {
    const { db, handlers } = makeAdminDb()
    createAdminClientMock.mockReturnValue(db)
    requireProjectAccessMock.mockRejectedValue(
      Object.assign(new Error('Немате пристап до овој проект'), { status: 403 }),
    )

    const res = await call()

    expect(res.status).toBe(403)
    expect(requireProjectAccessMock).toHaveBeenCalledWith(db, USER_ID, PROJECT_ID)
    // The role + data queries must not run without passing the access gate.
    expect(handlers.has('profiles.maybeSingle')).toBe(false)
    expect(handlers.has('photos.chain')).toBe(false)
    expect(handlers.has('defects.chain')).toBe(false)
    expect(handlers.has('work_orders.chain')).toBe(false)
  })

  it('returns the full contract for a site_manager with project-tz KPIs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))

    const { db, handlers } = managerDb()
    createAdminClientMock.mockReturnValue(db)

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.projectId).toBe(PROJECT_ID)

    // risk: explainable score present and typed
    expect(typeof body.data.risk.score).toBe('number')
    expect(['low', 'medium', 'high', 'critical']).toContain(body.data.risk.tier)
    expect(typeof body.data.risk.quality).toBe('number')
    expect(typeof body.data.risk.delivery).toBe('number')
    expect(typeof body.data.risk.evidence).toBe('number')
    expect(Array.isArray(body.data.risk.signals)).toBe(true)

    // summary: deterministic KPI values for the fixture
    expect(body.data.summary).toEqual({
      photoCount: 3,
      activeDays: 2, // two photos same day (Aug 12) + Aug 1
      openDefects: 1,
      inProgressDefects: 0,
      resolvedDefects: 1,
      openWorkOrders: 1, // pending; the done one is not open
      overdueWorkOrders: 1, // due 2026-08-09 < today 2026-08-14 (Skopje)
      photosLast30Days: 3,
      firstPhotoDate: '2026-08-01',
      lastPhotoDate: '2026-08-12',
    })

    // Project tz short-circuits the company fallback (no profiles/companies lookups).
    expect(handlers.has('profiles.single')).toBe(false)
    expect(handlers.has('companies.single')).toBe(false)
    // requireProjectAccess ran with the admin client.
    expect(requireProjectAccessMock).toHaveBeenCalledWith(db, USER_ID, PROJECT_ID)
  })

  it('returns the full contract for an admin', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))

    const { db, handlerFor } = managerDb()
    handlerFor('profiles.maybeSingle').mockResolvedValue(ok({ role: 'admin' }))
    createAdminClientMock.mockReturnValue(db)

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.summary.openWorkOrders).toBe(1)
    expect(body.data.summary.overdueWorkOrders).toBe(1)
  })

  it('returns the reduced read view (no work-order details) for a read-only role', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))

    const { db, handlerFor } = managerDb()
    handlerFor('profiles.maybeSingle').mockResolvedValue(ok({ role: 'photographer' }))
    createAdminClientMock.mockReturnValue(db)

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(200)
    // Risk + photo/defect KPIs are still present…
    expect(body.data.risk.score).toBeTypeOf('number')
    expect(body.data.summary.photoCount).toBe(3)
    expect(body.data.summary.activeDays).toBe(2)
    expect(body.data.summary.openDefects).toBe(1)
    // …but work-order/internal details are omitted.
    expect(body.data.summary).not.toHaveProperty('openWorkOrders')
    expect(body.data.summary).not.toHaveProperty('overdueWorkOrders')
  })
})

// ============================================================================
// Pure helper unit tests
// ============================================================================

describe('computeAnalyticsSummary (pure)', () => {
  it('counts distinct active days and trailing-30-day photos, tz-aware', () => {
    const summary = computeAnalyticsSummary(
      [
        { taken_at: '2026-08-12T09:00:00Z', created_at: '2026-08-12T09:00:00Z' },
        { taken_at: '2026-08-12T15:00:00Z', created_at: '2026-08-12T15:00:00Z' },
        { taken_at: null, created_at: '2026-08-13T08:00:00Z' },
        { taken_at: '2026-06-01T09:00:00Z', created_at: '2026-06-01T09:00:00Z' }, // outside 30d
      ],
      [],
      [],
      new Date('2026-08-14T12:00:00Z'),
      'UTC',
    )

    expect(summary.photoCount).toBe(4)
    expect(summary.activeDays).toBe(3)
    expect(summary.photosLast30Days).toBe(3)
    expect(summary.firstPhotoDate).toBe('2026-06-01')
    expect(summary.lastPhotoDate).toBe('2026-08-13')
  })

  it('counts overdue work orders only among active (pending/in_progress) ones', () => {
    const summary = computeAnalyticsSummary(
      [],
      [],
      [
        { status: 'pending', due_date: '2026-08-09' },
        { status: 'in_progress', due_date: '2026-08-20' },
        { status: 'done', due_date: '2026-08-05' }, // completed, never "overdue"
      ],
      new Date('2026-08-14T12:00:00Z'),
      'UTC',
    )

    expect(summary.openWorkOrders).toBe(2)
    expect(summary.overdueWorkOrders).toBe(1)
  })

  it('breaks defects into open / in_progress / resolved buckets', () => {
    const summary = computeAnalyticsSummary(
      [],
      [
        { severity: 'high', status: 'open', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { severity: 'medium', status: 'in_progress', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { severity: 'low', status: 'resolved', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { severity: 'low', status: 'closed', due_date: null, created_at: '2026-08-01T00:00:00Z' },
      ],
      [],
      new Date('2026-08-14T12:00:00Z'),
      'UTC',
    )

    expect(summary.openDefects).toBe(1)
    expect(summary.inProgressDefects).toBe(1)
    expect(summary.resolvedDefects).toBe(2)
  })
})

describe('computeEvidenceStats (pure)', () => {
  it('counts distinct project-tz days with any evidence inside the window', () => {
    const stats = computeEvidenceStats(
      [
        { taken_at: '2026-08-12T09:00:00Z', created_at: '2026-08-12T09:00:00Z' },
        { taken_at: '2026-08-12T15:00:00Z', created_at: '2026-08-12T15:00:00Z' },
        { taken_at: '2026-08-01T09:00:00Z', created_at: '2026-08-01T09:00:00Z' }, // outside window
      ],
      [{ created_at: '2026-08-13T10:00:00Z' }],
      [{ check_in: '2026-08-14T08:00:00Z' }],
      new Date('2026-08-14T12:00:00Z'),
      'UTC',
      7,
    )

    expect(stats.evidenceDays).toBe(3) // Aug 12, 13, 14
    expect(stats.lastEvidenceDate).toBe('2026-08-14T08:00:00Z')
  })
})

describe('buildRiskInput (pure)', () => {
  it('normalizes due_date day keys to start-of-day instants in the project tz', () => {
    const tz = 'America/New_York'
    const today = todayStartInTz(tz, new Date('2026-08-14T12:00:00Z'))

    const input = buildRiskInput(
      [{ severity: 'high', status: 'open', due_date: '2026-08-10', created_at: '2026-08-01T09:00:00Z' }],
      [{ status: 'pending', due_date: '2026-08-20' }],
      { evidenceDays: 3, lastEvidenceDate: '2026-08-14T08:00:00Z' },
      today,
      tz,
    )

    // A raw '2026-08-10' would parse as UTC midnight → day key '2026-08-09'
    // in New York; the normalized instant maps back to Aug 10, so the
    // tz-aware diffDays measures 4 whole calendar days, not 5.
    expect(input.defects[0].due_date).toBe('2026-08-10T04:00:00.000Z')
    expect(input.diffDays?.(new Date('2026-08-10T04:00:00Z'), today)).toBe(4)
    expect(input.workOrders[0].due_date).toBe('2026-08-20T04:00:00.000Z')
    expect(input.windowDays).toBe(7)
  })
})

describe('isManagerRole (pure)', () => {
  it('returns true only for site_manager and admin', () => {
    expect(isManagerRole('site_manager')).toBe(true)
    expect(isManagerRole('admin')).toBe(true)
    expect(isManagerRole('photographer')).toBe(false)
    expect(isManagerRole('foreman')).toBe(false)
    expect(isManagerRole('client')).toBe(false)
    expect(isManagerRole(null)).toBe(false)
    expect(isManagerRole(undefined)).toBe(false)
  })
})

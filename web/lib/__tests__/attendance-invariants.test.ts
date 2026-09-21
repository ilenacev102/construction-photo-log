import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/attendance/route'

const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'

// ============================================================================
// Pure models of the DB invariants in 20260814000002_attendance_invariants.sql
// ============================================================================

type AttendanceRow = {
  id: string
  user_id: string
  project_id: string
  check_in: string
  check_out: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Model of the partial unique index
 * `idx_attendance_one_open_per_user_project (user_id, project_id)
 *  WHERE check_out IS NULL` — true when the insert would violate it.
 */
function wouldViolateOneOpenPerUserProject(
  existing: AttendanceRow[],
  candidate: { user_id: string; project_id: string; check_out: string | null },
): boolean {
  if (candidate.check_out !== null) return false
  return existing.some(
    (row) =>
      row.check_out === null &&
      row.user_id === candidate.user_id &&
      row.project_id === candidate.project_id,
  )
}

/** Model of CHECK constraint `attendance_duration_sane`. */
function isDurationSane(check_in: string, check_out: string | null): boolean {
  if (check_out === null) return true
  return Date.parse(check_out) > Date.parse(check_in)
}

/** Model of the 24h cap raised by `enforce_attendance_duration_cap()`. */
function exceedsDurationCap(check_in: string, check_out: string | null): boolean {
  if (check_out === null) return false
  return Date.parse(check_out) - Date.parse(check_in) > DAY_MS
}

describe('attendance invariants (DB constraints expressed as pure helpers)', () => {
  const open = (overrides: Partial<AttendanceRow> = {}): AttendanceRow => ({
    id: 'log-1',
    user_id: USER_ID,
    project_id: 'p1',
    check_in: '2026-08-14T08:00:00.000Z',
    check_out: null,
    ...overrides,
  })

  describe('one open check-in per (user, project)', () => {
    it('rejects a second OPEN row for the same user and project', () => {
      const existing = [open()]
      expect(
        wouldViolateOneOpenPerUserProject(existing, {
          user_id: USER_ID,
          project_id: 'p1',
          check_out: null,
        }),
      ).toBe(true)
    })

    it('allows a CLOSED row for the same user and project', () => {
      const existing = [open()]
      expect(
        wouldViolateOneOpenPerUserProject(existing, {
          user_id: USER_ID,
          project_id: 'p1',
          check_out: '2026-08-14T16:00:00.000Z',
        }),
      ).toBe(false)
    })

    it('allows an OPEN row for the same user on a different project', () => {
      const existing = [open()]
      expect(
        wouldViolateOneOpenPerUserProject(existing, {
          user_id: USER_ID,
          project_id: 'p2',
          check_out: null,
        }),
      ).toBe(false)
    })

    it('allows an OPEN row for a different user on the same project', () => {
      const existing = [open()]
      expect(
        wouldViolateOneOpenPerUserProject(existing, {
          user_id: OTHER_USER_ID,
          project_id: 'p1',
          check_out: null,
        }),
      ).toBe(false)
    })
  })

  describe('duration sanity (attendance_duration_sane)', () => {
    it('accepts an open row (check_out IS NULL)', () => {
      expect(isDurationSane('2026-08-14T08:00:00.000Z', null)).toBe(true)
    })

    it('accepts check_out strictly after check_in', () => {
      expect(
        isDurationSane('2026-08-14T08:00:00.000Z', '2026-08-14T08:00:01.000Z'),
      ).toBe(true)
    })

    it('rejects a zero duration (check_out == check_in)', () => {
      expect(
        isDurationSane('2026-08-14T08:00:00.000Z', '2026-08-14T08:00:00.000Z'),
      ).toBe(false)
    })

    it('rejects a negative duration (check_out < check_in)', () => {
      expect(
        isDurationSane('2026-08-14T08:00:00.000Z', '2026-08-14T07:59:59.000Z'),
      ).toBe(false)
    })
  })

  describe('24h cap (enforce_attendance_duration_cap)', () => {
    it('rejects a span longer than 24 hours', () => {
      expect(
        exceedsDurationCap('2026-08-14T08:00:00.000Z', '2026-08-15T08:00:01.000Z'),
      ).toBe(true)
    })

    it('allows a span of exactly 24 hours', () => {
      expect(
        exceedsDurationCap('2026-08-14T08:00:00.000Z', '2026-08-15T08:00:00.000Z'),
      ).toBe(false)
    })

    it('allows a span under 24 hours', () => {
      expect(
        exceedsDurationCap('2026-08-14T08:00:00.000Z', '2026-08-14T16:00:00.000Z'),
      ).toBe(false)
    })

    it('allows an open row (check_out IS NULL)', () => {
      expect(exceedsDurationCap('2026-08-14T08:00:00.000Z', null)).toBe(false)
    })
  })
})

// ============================================================================
// Route-level tests (ownership + project-tz today filter)
// ============================================================================

const {
  getUserMock,
  createClientMock,
  createAdminClientMock,
  requireProjectAccessMock,
  requireProjectMutateMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireProjectAccessMock: vi.fn(),
  requireProjectMutateMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/company-auth', () => ({
  getCompanyContext: vi.fn(),
  getAccessibleProjectIds: vi.fn(),
  isAdminUser: vi.fn(),
  requireProjectAccess: requireProjectAccessMock,
  requireProjectMutate: requireProjectMutateMock,
}))

type RowResult = { data: unknown; error: unknown }

type DbHandler = Mock<(...args: unknown[]) => RowResult>

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/**
 * Minimal fluent mock of the Supabase query builder used by the attendance
 * route. `.single()` resolves via the `${table}.single` handler; an awaited
 * chain without a terminal resolves via the `${table}.chain` handler. `.gte`
 * is a spy so tests can assert the project-tz start-of-day filter.
 */
function makeAdminDb() {
  const handlers = new Map<string, DbHandler>()
  const gteSpy = vi.fn()

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
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      gte: (...args: unknown[]) => {
        gteSpy(...args)
        return chain
      },
      update: () => chain,
      single: () => handlerFor(`${table}.single`)(),
      then: (resolve: (v: RowResult) => void) =>
        resolve(handlerFor(`${table}.chain`)()),
    }
    return chain
  }

  return {
    db: { from: (table: string) => buildChain(table) },
    gteSpy,
    handlers,
    handlerFor,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/attendance checkOut ownership', () => {
  it("returns 403 when the caller is not the log's owner", async () => {
    const { db, handlerFor } = makeAdminDb()
    handlerFor('attendance_logs.single').mockResolvedValue(
      ok({ project_id: 'p1', user_id: OTHER_USER_ID }),
    )
    createAdminClientMock.mockReturnValue(db)

    const res = await POST(
      new NextRequest('http://localhost/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ subAction: 'checkOut', logId: '11111111-1111-4111-8111-111111111111' }),
      }),
    )

    expect(res.status).toBe(403)
    expect(requireProjectMutateMock).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ data: null, error: expect.any(String) })
  })

  it('allows the owner to check out their own log', async () => {
    const { db, handlerFor } = makeAdminDb()
    const load = handlerFor('attendance_logs.single')
    load
      .mockResolvedValueOnce(ok({ project_id: 'p1', user_id: USER_ID }))
      .mockResolvedValueOnce(
        ok({ id: 'log-1', project_id: 'p1', user_id: USER_ID, check_out: '2026-08-14T16:00:00.000Z' }),
      )
    createAdminClientMock.mockReturnValue(db)
    requireProjectMutateMock.mockResolvedValue({ ctx: null })

    const res = await POST(
      new NextRequest('http://localhost/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ subAction: 'checkOut', logId: '11111111-1111-4111-8111-111111111111' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(requireProjectMutateMock).toHaveBeenCalledWith(db, USER_ID, 'p1')
    expect(await res.json()).toEqual({
      data: {
        id: 'log-1',
        project_id: 'p1',
        user_id: USER_ID,
        check_out: '2026-08-14T16:00:00.000Z',
      },
      error: null,
    })
  })
})

describe('GET /api/attendance today=true uses the project timezone', () => {
  function projectIdUrl(today = true): NextRequest {
    return new NextRequest(
      `http://localhost/api/attendance?projectId=p1&today=${today}`,
    )
  }

  it('filters from start-of-day in the company timezone (project -> company -> DEFAULT_TZ)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T22:30:00Z'))

    const { db, gteSpy, handlerFor } = makeAdminDb()
    handlerFor('projects.single').mockResolvedValue(
      ok({ timezone: null, user_id: USER_ID }),
    )
    handlerFor('profiles.single').mockResolvedValue(
      ok({ company_name: 'Acme' }),
    )
    handlerFor('companies.single').mockResolvedValue(
      ok({ timezone: 'Europe/Skopje' }),
    )
    handlerFor('attendance_logs.chain').mockResolvedValue(
      ok([{ id: 'log-1', project_id: 'p1', check_in: '2026-08-14T22:05:00Z', check_out: null }]),
    )
    createAdminClientMock.mockReturnValue(db)
    requireProjectAccessMock.mockResolvedValue({ ctx: null })

    const res = await GET(projectIdUrl())

    // 2026-08-14 22:30Z == 00:30 on Aug 15 in Skopje (UTC+2) → the filter must
    // be anchored at Aug 15 00:00 Skopje == 2026-08-14T22:00:00Z, NOT UTC
    // midnight (2026-08-14T00:00:00Z).
    expect(gteSpy).toHaveBeenCalledWith('check_in', '2026-08-14T22:00:00.000Z')
    expect(res.status).toBe(200)
  })

  it('prefers projects.timezone over the company fallback', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T22:30:00Z'))

    const { db, gteSpy, handlerFor, handlers } = makeAdminDb()
    handlerFor('projects.single').mockResolvedValue(
      ok({ timezone: 'America/New_York', user_id: USER_ID }),
    )
    handlerFor('attendance_logs.chain').mockResolvedValue(ok([]))
    createAdminClientMock.mockReturnValue(db)
    requireProjectAccessMock.mockResolvedValue({ ctx: null })

    const res = await GET(projectIdUrl())

    // 22:30Z == 18:30 on Aug 14 in New York (EDT, UTC-4) → start-of-day is
    // Aug 14 00:00 EDT == 2026-08-14T04:00:00Z.
    expect(gteSpy).toHaveBeenCalledWith('check_in', '2026-08-14T04:00:00.000Z')
    // No company lookup happened — the project tz short-circuits.
    expect(handlers.has('profiles.single')).toBe(false)
    expect(handlers.has('companies.single')).toBe(false)
    expect(res.status).toBe(200)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { workOrdersToCsv, attendanceToCsv, escapeCsvField, GET } from '../export/route'
import { EXPORT_TYPES, type ExportType } from '@/lib/export'

/**
 * Export route tests — covers the new work_orders and attendance converters
 * plus the escapeCsvField / type guard helpers.
 */

const { getUserMock, createAdminClientMock, requireProjectAccessMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireProjectAccessMock: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn(async () => {
    const result = await getUserMock()
    if (result.error) throw result.error
    return { user: result.user }
  }),
  apiErrorResponse: vi.fn((err: unknown) => {
    const status = (err as { status?: number }).status ?? 500
    return new Response(JSON.stringify({ error: (err as Error).message }), { status })
  }),
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectAccess: requireProjectAccessMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/errors', () => ({
  errorResponse: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status })
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
  })
  createAdminClientMock.mockReturnValue({})
  requireProjectAccessMock.mockResolvedValue(undefined)
})

function request(type: string, projectId = 'proj-1'): NextRequest {
  return new NextRequest(`http://localhost/api/export?projectId=${projectId}&type=${type}`)
}

// ---------------------------------------------------------------------------
// escapeCsvField
// ---------------------------------------------------------------------------
describe('escapeCsvField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('quotes fields containing commas', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('quotes fields containing double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

// ---------------------------------------------------------------------------
// workOrdersToCsv
// ---------------------------------------------------------------------------
describe('workOrdersToCsv', () => {
  it('produces correct CSV with headers and data rows', () => {
    const csv = workOrdersToCsv([
      {
        id: 'wo-1',
        title: 'Fix rebar',
        description: 'Bent rebar at A3',
        location: 'Zone A',
        assigned_to: 'user-2',
        assigned_by: 'user-1',
        priority: 'high',
        status: 'pending',
        due_date: '2026-09-15',
        created_at: '2026-09-01T10:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      },
    ])

    const lines = csv.split('\r\n')
    // BOM prefix on first line (String.trim strips BOM, so check csv directly)
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(lines[0]).toBe('\uFEFFid,title,description,location,assigned_to,assigned_by,priority,status,due_date,created_at,updated_at')
    expect(lines[1]).toBe('wo-1,Fix rebar,Bent rebar at A3,Zone A,user-2,user-1,high,pending,2026-09-15,2026-09-01T10:00:00Z,2026-09-01T10:00:00Z')
  })

  it('handles nullable fields as empty strings', () => {
    const csv = workOrdersToCsv([
      {
        id: 'wo-2',
        title: 'Inspect formwork',
        description: null,
        location: null,
        assigned_to: null,
        assigned_by: 'user-1',
        priority: 'medium',
        status: 'in_progress',
        due_date: null,
        created_at: '2026-09-02T08:00:00Z',
        updated_at: '2026-09-02T08:00:00Z',
      },
    ])

    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('wo-2,Inspect formwork,,,,user-1,medium,in_progress,,2026-09-02T08:00:00Z,2026-09-02T08:00:00Z')
  })

  it('returns only the BOM when given an empty array', () => {
    const csv = workOrdersToCsv([])
    // Only headers + CRLF
    expect(csv).toContain('\uFEFFid,title')
  })
})

// ---------------------------------------------------------------------------
// attendanceToCsv
// ---------------------------------------------------------------------------
describe('attendanceToCsv', () => {
  it('produces correct CSV with headers and data rows', () => {
    const csv = attendanceToCsv([
      {
        id: 'att-1',
        user_id: 'user-2',
        check_in: '2026-09-01T07:00:00Z',
        check_out: '2026-09-01T17:00:00Z',
        duration_minutes: 600,
        note: 'Full day',
        created_at: '2026-09-01T07:00:00Z',
      },
    ])

    const lines = csv.split('\r\n')
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(lines[0]).toBe('\uFEFFid,user_id,check_in,check_out,duration_minutes,note,created_at')
    expect(lines[1]).toBe('att-1,user-2,2026-09-01T07:00:00Z,2026-09-01T17:00:00Z,600,Full day,2026-09-01T07:00:00Z')
  })

  it('handles nullable check_out, duration_minutes, and note as empty strings', () => {
    const csv = attendanceToCsv([
      {
        id: 'att-2',
        user_id: 'user-3',
        check_in: '2026-09-02T08:00:00Z',
        check_out: null,
        duration_minutes: null,
        note: null,
        created_at: '2026-09-02T08:00:00Z',
      },
    ])

    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('att-2,user-3,2026-09-02T08:00:00Z,,,,2026-09-02T08:00:00Z')
  })

  it('returns only the BOM when given an empty array', () => {
    const csv = attendanceToCsv([])
    expect(csv).toContain('\uFEFFid,user_id')
  })
})

// ---------------------------------------------------------------------------
// EXPORT_TYPES type guard
// ---------------------------------------------------------------------------
describe('EXPORT_TYPES', () => {
  it('includes all 5 expected types', () => {
    expect(EXPORT_TYPES).toEqual(['defects', 'photos', 'logs', 'work_orders', 'attendance'])
  })

  it.each<ExportType>(['defects', 'photos', 'logs', 'work_orders', 'attendance'])(
    'is a valid ExportType: %s',
    (type) => {
      expect(EXPORT_TYPES).toContain(type)
    },
  )
})

// ---------------------------------------------------------------------------
// GET handler — type guard and error handling
// ---------------------------------------------------------------------------
describe('GET /api/export', () => {
  it('returns 400 for an invalid type parameter', async () => {
    const res = await GET(request('invalid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid type parameter/)
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/export?type=defects'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Missing projectId/)
  })

  it('accepts work_orders type', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    createAdminClientMock.mockReturnValue({ from: mockFrom })

    const res = await GET(request('work_orders'))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('work_orders')
  })

  it('accepts attendance type', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    createAdminClientMock.mockReturnValue({ from: mockFrom })

    const res = await GET(request('attendance'))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('attendance_logs')
  })
})

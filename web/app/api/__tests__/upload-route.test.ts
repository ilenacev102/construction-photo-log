import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../upload/route'

/**
 * P1-4 (worker dashboard "My photos" always empty) — the photos insert in
 * POST /api/upload never wrote photos.user_id, so the dashboard filter
 * `p.user_id === profile?.id` (worker/page.tsx:113) matched nothing even on
 * databases that have the column. This test locks the insert payload to
 * carry the authenticated user id.
 */
const USER_ID = 'user-1'
const PROJECT_ID = '00000000-0000-4000-8000-000000000001'

const {
  requireAuthMock,
  createAdminClientMock,
  requireProjectMutateMock,
  compressImageMock,
  createResponsiveVariantsMock,
  createServerClientMock,
  cookiesMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireProjectMutateMock: vi.fn(),
  compressImageMock: vi.fn(),
  createResponsiveVariantsMock: vi.fn(),
  createServerClientMock: vi.fn(),
  cookiesMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectMutate: requireProjectMutateMock,
  requireProjectAccess: vi.fn(),
  getCompanyContext: vi.fn(),
}))

vi.mock('@/lib/image/compress', () => ({
  compressImage: compressImageMock,
  createResponsiveVariants: createResponsiveVariantsMock,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

// Keep the real apiErrorResponse, mock only requireAuth.
vi.mock('@/lib/api/auth-guard', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api/auth-guard')>()
  return { ...mod, requireAuth: requireAuthMock }
})

type RowResult = { data: unknown; error: unknown }

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/** Captures the photos insert payload and resolves id for .single(). */
function makeAdminDb() {
  let insertPayload: Record<string, unknown> | null = null
  const db = {
    getLastInsert: () => insertPayload,
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        insertPayload = payload
        return { select: () => ({ single: () => ok({ id: 'photo-1' }) }) }
      },
    }),
  }
  return db
}

function makeFormRequest(): NextRequest {
  const formData = new FormData()
  formData.append(
    'file',
    new File([Buffer.from('fake-image-bytes')], 'test.jpg', { type: 'image/jpeg' }),
  )
  formData.append('projectId', PROJECT_ID)
  formData.append('note', 'foundation pour')
  formData.append('takenAt', '2026-08-11T10:00:00Z')
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData })
}

import { clearRateLimits } from '@/lib/api/rate-limit'

beforeEach(() => {
  clearRateLimits()
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue({ user: { id: USER_ID } })
  requireProjectMutateMock.mockResolvedValue(undefined)
  compressImageMock.mockResolvedValue(Buffer.from('compressed'))
  createResponsiveVariantsMock.mockResolvedValue({
    full: Buffer.from('compressed'),
    thumbnail: Buffer.from('thumb'),
  })
  cookiesMock.mockResolvedValue({
    getAll: () => [],
    set: () => {},
  })
  createServerClientMock.mockReturnValue({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  })
})

describe('POST /api/upload (P1-4: photos.user_id must be written on insert)', () => {
  it('stores the authenticated user id in the photos insert payload', async () => {
    const admin = makeAdminDb()
    createAdminClientMock.mockReturnValue(admin)

    const res = await POST(makeFormRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ data: { photoId: 'photo-1' }, error: null })
    expect(admin.getLastInsert()).toEqual(
      expect.objectContaining({
        project_id: PROJECT_ID,
        user_id: USER_ID,
        note: 'foundation pour',
      }),
    )
  })

  it('keeps user_id out of the payload only after upload succeeds (no orphan rows)', async () => {
    const admin = makeAdminDb()
    createAdminClientMock.mockReturnValue(admin)
    // Storage failure → DB insert must never happen.
    createServerClientMock.mockReturnValue({
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({ error: { message: 'storage down' } }),
        }),
      },
    })

    const res = await POST(makeFormRequest())
    expect(res.status).toBe(500)
    expect(admin.getLastInsert()).toBeNull()
  })
})

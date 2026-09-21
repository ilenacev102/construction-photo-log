import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../schemas/route'
import { getSignedUrls } from '@/lib/storage/signed-url'

/**
 * P1-1 — storage signed-URL oracle via `site_schemas.image_url` (cross-tenant).
 *
 * The route must whitelist `image_url` to the project's own schema folder
 * (`schemas/{projectId}/...`, normalized via toStoragePath) at POST time
 * (foreign path → 400) and must not sign foreign paths on GET (image_url →
 * null). Traversal segments ("..") are rejected too.
 */
const USER_ID = 'user-1'
const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

const { getUserMock, createClientMock, createAdminClientMock, requireProjectAccessMock, requireProjectMutateMock } =
  vi.hoisted(() => ({
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
  requireProjectAccess: requireProjectAccessMock,
  requireProjectMutate: requireProjectMutateMock,
  getCompanyContext: vi.fn(),
}))

// Keep the real toStoragePath / toSchemaStoragePath normalization, mock only
// the network-bound signing call so tests can assert whether it ran.
vi.mock('@/lib/storage/signed-url', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage/signed-url')>()
  return { ...mod, getSignedUrls: vi.fn() }
})

const signedBatch = vi.mocked(getSignedUrls)

type RowResult = { data: unknown; error: unknown }

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/**
 * Minimal fluent mock of the Supabase query builder used by schemas routes:
 *   GET  -> .from('site_schemas').select().eq().order()   (awaited chain)
 *   POST -> .from('site_schemas').insert().select().single() (`${table}.single`)
 */
function makeAdminDb(handlers: Record<string, () => RowResult>) {
  const call = (key: string) => handlers[key]?.() ?? { data: null, error: null }
  const db = {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        insert: () => chain,
        single: () => call(`${table}.single`),
        then: (resolve: (v: RowResult) => void) => resolve(call(`${table}.chain`)),
      }
      return chain
    },
  }
  return db
}

function postRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/schemas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
  requireProjectAccessMock.mockResolvedValue({ ctx: null })
  requireProjectMutateMock.mockResolvedValue({ ctx: null })
})

describe('POST /api/schemas (P1-1: whitelist image_url to the project schema folder)', () => {
  it('rejects a foreign storage path with 400 and never inserts', async () => {
    // Insert must not run: make the terminal throw if reached.
    let insertReached = false
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'site_schemas.single': () => {
          insertReached = true
          return ok(null)
        },
      }),
    )

    const res = await POST(
      postRequest({
        projectId: PROJECT_ID,
        name: 'Ground floor',
        imageUrl:
          'https://xyz.supabase.co/storage/v1/object/public/construction-photos/other-company/proofs/x.jpg',
      }),
    )

    expect(insertReached).toBe(false)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('imageUrl')
  })

  it('rejects a raw path outside the project schema folder with 400', async () => {
    createAdminClientMock.mockReturnValue(makeAdminDb({}))

    const res = await POST(
      postRequest({
        projectId: PROJECT_ID,
        name: 'Ground floor',
        imageUrl: 'schemas/other-proj/1712345678.png',
      }),
    )

    expect(res.status).toBe(400)
  })

  it('rejects traversal segments even when the folder prefix matches', async () => {
    let insertReached = false
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'site_schemas.single': () => {
          insertReached = true
          return ok(null)
        },
      }),
    )

    const res = await POST(
      postRequest({
        projectId: PROJECT_ID,
        name: 'Ground floor',
        imageUrl: `schemas/${PROJECT_ID}/../../other-company/x.jpg`,
      }),
    )

    expect(insertReached).toBe(false)
    expect(res.status).toBe(400)
  })

  it('accepts a path inside the project schema folder (200, row returned)', async () => {
    const inserted = {
      id: 'schema-1',
      project_id: PROJECT_ID,
      name: 'Ground floor',
      image_url: `schemas/${PROJECT_ID}/1712345678.png`,
    }
    createAdminClientMock.mockReturnValue(
      makeAdminDb({ 'site_schemas.single': () => ok(inserted) }),
    )

    const res = await POST(
      postRequest({
        projectId: PROJECT_ID,
        name: 'Ground floor',
        imageUrl: `https://xyz.supabase.co/storage/v1/object/public/construction-photos/schemas/${PROJECT_ID}/1712345678.png`,
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(inserted)
  })
})

describe('GET /api/schemas (P1-1: never sign foreign image_url)', () => {
  it('returns image_url = null for a stored foreign path and does not sign it', async () => {
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'site_schemas.chain': () =>
          ok([
            {
              id: 'schema-1',
              project_id: PROJECT_ID,
              name: 'Ground floor',
              image_url: 'schemas/other-proj/1712345678.png',
            },
          ]),
      }),
    )

    const res = await GET(new NextRequest(`http://localhost/api/schemas?projectId=${PROJECT_ID}`))

    expect(signedBatch).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].image_url).toBeNull()
  })

  it('signs a stored path inside the project schema folder', async () => {
    signedBatch.mockResolvedValue(['https://signed.example/url'])
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'site_schemas.chain': () =>
          ok([
            {
              id: 'schema-1',
              project_id: PROJECT_ID,
              name: 'Ground floor',
              image_url: `schemas/${PROJECT_ID}/1712345678.png`,
            },
          ]),
      }),
    )

    const res = await GET(new NextRequest(`http://localhost/api/schemas?projectId=${PROJECT_ID}`))

    expect(signedBatch).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].image_url).toBe('https://signed.example/url')
  })
})
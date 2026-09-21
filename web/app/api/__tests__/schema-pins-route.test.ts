import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../schema-pins/route'
import { getSignedUrls } from '@/lib/storage/signed-url'

/**
 * P1-1 (cross-tenant oracle) — depth: GET /api/schema-pins?photoId=... joins
 * `site_schemas(name, image_url)` and signs the schema image_url. The schema
 * column is the same attacker-influenced storage value as /api/schemas, so a
 * foreign path must not be signed (image_url → null), only paths inside
 * `schemas/{photo.project_id}/...`.
 */
const USER_ID = 'user-1'
const PROJECT_ID = 'proj-1'
const PHOTO_ID = 'photo-1'

const { getUserMock, createClientMock, createAdminClientMock, requireProjectAccessMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    requireProjectAccessMock: vi.fn(),
  }),
)

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectAccess: requireProjectAccessMock,
  requireProjectMutate: vi.fn(),
  getCompanyContext: vi.fn(),
}))

// Keep the real toStoragePath / isProjectSchemaPath normalization, mock only
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

function makeAdminDb(handlers: Record<string, () => RowResult>) {
  const call = (key: string) => handlers[key]?.() ?? { data: null, error: null }
  const db = {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        single: () => call(`${table}.single`),
        then: (resolve: (v: RowResult) => void) => resolve(call(`${table}.chain`)),
      }
      return chain
    },
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
  requireProjectAccessMock.mockResolvedValue({ ctx: null })
})

describe('GET /api/schema-pins?photoId= (P1-1: never sign foreign schema image_url)', () => {
  it('returns site_schemas.image_url = null for a foreign stored path and does not sign it', async () => {
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'photos.single': () => ok({ id: PHOTO_ID, project_id: PROJECT_ID }),
        'schema_photo_pins.chain': () =>
          ok([
            {
              id: 'pin-1',
              schema_id: 'schema-1',
              photo_id: PHOTO_ID,
              x: 10,
              y: 20,
              created_at: '2026-08-01T00:00:00Z',
              site_schemas: { name: 'Ground floor', image_url: 'schemas/other-proj/1712345678.png' },
            },
          ]),
      }),
    )

    const res = await GET(new NextRequest(`http://localhost/api/schema-pins?photoId=${PHOTO_ID}`))

    expect(signedBatch).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].site_schemas.image_url).toBeNull()
  })

  it('signs a schema image_url inside the photo project schema folder', async () => {
    signedBatch.mockResolvedValue(['https://signed.example/url'])
    createAdminClientMock.mockReturnValue(
      makeAdminDb({
        'photos.single': () => ok({ id: PHOTO_ID, project_id: PROJECT_ID }),
        'schema_photo_pins.chain': () =>
          ok([
            {
              id: 'pin-1',
              schema_id: 'schema-1',
              photo_id: PHOTO_ID,
              x: 10,
              y: 20,
              created_at: '2026-08-01T00:00:00Z',
              site_schemas: {
                name: 'Ground floor',
                image_url: `schemas/${PROJECT_ID}/1712345678.png`,
              },
            },
          ]),
      }),
    )

    const res = await GET(new NextRequest(`http://localhost/api/schema-pins?photoId=${PHOTO_ID}`))

    expect(signedBatch).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].site_schemas.image_url).toBe('https://signed.example/url')
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as postItem } from '../labels/items/route'
import { PATCH as patchItem, DELETE as deleteItem } from '../labels/items/[id]/route'
import { PATCH as patchGroup, DELETE as deleteGroup } from '../labels/groups/[id]/route'
import { requireLabelGroupAccess } from '@/lib/api/company-auth'

/**
 * P2-4 — labels write paths not company-scoped (defense-in-depth).
 *
 * The RLS layer is already company-scoped (T1.3: 20260730000001_create_labels.sql,
 * policies join label_groups -> companies via auth.uid()), so the residual is a
 * ROUTE-level re-check: every labels/label_groups write must verify the target
 * group belongs to the caller's company (or the caller is an admin).
 *
 * Foreign-company write -> 403, and the mutation must never reach the DB.
 */
const USER_ID = 'user-1'

const { getUserMock, createClientMock, getCompanyContextMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  getCompanyContextMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

// Keep the real requireLabelGroupAccess (and its internal getCompanyContext
// call — module-internal references are NOT intercepted by vi.mock), so the
// helper's behavior is driven entirely by the fluent db mock. The mocked
// getCompanyContext export only affects routes that call it directly
// (e.g. labels/groups POST).
vi.mock('@/lib/api/company-auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api/company-auth')>()
  return { ...mod, getCompanyContext: getCompanyContextMock }
})

type RowResult = { data: unknown; error: unknown }

// The fluent db mock is a structural test double, not a real SupabaseClient.
// Cast through the helper's own parameter type so call sites stay typed.
type LabelDb = Parameters<typeof requireLabelGroupAccess>[0]
function asLabelDb(db: ReturnType<typeof makeLabelsDb>): LabelDb {
  return db as unknown as LabelDb
}

function ok(data: unknown): RowResult {
  return { data, error: null }
}

/**
 * Fluent mock keyed by `${table}.${selectCols}` so a route that both fetches
 * and updates the same table (labels/items/[id]) can distinguish the calls:
 *   .select('id, group_id').single()      -> `labels.id, group_id.single`
 *   .update().select().single()           -> `labels.*.single`
 *   awaited chain (delete / no terminal)  -> `${table}.*.chain`
 */
function makeLabelsDb(handlers: Record<string, () => RowResult>) {
  const call = (key: string) => handlers[key]?.() ?? { data: null, error: null }
  const db = {
    from: (table: string) => {
      let cols = '*'
      const chain = {
        select: (c?: string) => {
          cols = c ?? '*'
          return chain
        },
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        single: () => call(`${table}.${cols}.single`),
        then: (resolve: (v: RowResult) => void) => resolve(call(`${table}.${cols}.chain`)),
      }
      return chain
    },
  }
  return db
}

function clientWithDb(db: ReturnType<typeof makeLabelsDb>) {
  return { auth: { getUser: getUserMock }, ...db }
}

function postRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'DELETE' })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const acmeCtx = { companyName: 'Acme', companyUserIds: [USER_ID], isAdmin: false }

/** Handler map: caller is a site_manager in Acme, target group is in Acme. */
function sameCompanyDb(extra?: Record<string, () => RowResult>) {
  return makeLabelsDb({
    'profiles.role.single': () => ok({ role: 'site_manager' }),
    'profiles.company_name, role.single': () =>
      ok({ company_name: 'Acme', role: 'site_manager' }),
    'companies.id.single': () => ok({ id: 'company-acme' }),
    'label_groups.company_id.single': () => ok({ company_id: 'company-acme' }),
    ...extra,
  })
}

/** Handler map: caller is a site_manager in Acme, target group is in FOREIGN. */
function foreignCompanyDb(extra?: Record<string, () => RowResult>) {
  return makeLabelsDb({
    'profiles.role.single': () => ok({ role: 'site_manager' }),
    'profiles.company_name, role.single': () =>
      ok({ company_name: 'Acme', role: 'site_manager' }),
    'companies.id.single': () => ok({ id: 'company-acme' }),
    'label_groups.company_id.single': () => ok({ company_id: 'company-foreign' }),
    ...extra,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } })
  getCompanyContextMock.mockResolvedValue(acmeCtx)
})

describe('P2-4 requireLabelGroupAccess helper', () => {
  it('throws 403 for a company-less user', async () => {
    // Real getCompanyContext sees a profile with no company -> returns null ctx.
    const db = makeLabelsDb({
      'profiles.company_name, role.single': () => ok({ company_name: null, role: 'user' }),
    })
    await expect(
      requireLabelGroupAccess(asLabelDb(db), USER_ID, 'group-1'),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('throws 403 when the group belongs to another company', async () => {
    const db = foreignCompanyDb()
    await expect(
      requireLabelGroupAccess(asLabelDb(db), USER_ID, 'group-1'),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('resolves when the group belongs to the caller company', async () => {
    const db = sameCompanyDb()
    await expect(requireLabelGroupAccess(asLabelDb(db), USER_ID, 'group-1')).resolves.toBeUndefined()
  })

  it('allows an admin regardless of the group company', async () => {
    // Real getCompanyContext sees role=admin -> returns admin ctx, helper returns early.
    const db = makeLabelsDb({
      'profiles.company_name, role.single': () => ok({ company_name: 'Acme', role: 'admin' }),
    })
    await expect(requireLabelGroupAccess(asLabelDb(db), USER_ID, 'group-1')).resolves.toBeUndefined()
  })
})

describe('POST /api/labels/items (P2-4)', () => {
  it('rejects creating a label in a foreign-company group with 403 and never inserts', async () => {
    let insertReached = false
    createClientMock.mockResolvedValue(
      clientWithDb(
        foreignCompanyDb({
          'labels.*.single': () => {
            insertReached = true
            return ok({ id: 'label-9' })
          },
        }),
      ),
    )

    const res = await postItem(
      postRequest('http://localhost/api/labels/items', {
        group_id: '99999999-9999-4999-8999-999999999999',
        name: 'Intruder',
        slug: 'intruder',
      }),
    )

    expect(insertReached).toBe(false)
    expect(res.status).toBe(403)
  })

  it('allows creating a label in a same-company group', async () => {
    createClientMock.mockResolvedValue(
      clientWithDb(
        sameCompanyDb({
          'labels.*.single': () => ok({ id: 'label-1', name: 'Safe' }),
        }),
      ),
    )

    const res = await postItem(
      postRequest('http://localhost/api/labels/items', {
        group_id: '11111111-1111-4111-8111-111111111111',
        name: 'Safe',
        slug: 'safe',
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ id: 'label-1', name: 'Safe' })
  })
})

describe('PATCH /api/labels/items/[id] (P2-4)', () => {
  it('rejects updating a label whose group is in a foreign company with 403 and never updates', async () => {
    let updateReached = false
    createClientMock.mockResolvedValue(
      clientWithDb(
        foreignCompanyDb({
          'labels.id, group_id.single': () =>
            ok({ id: 'label-1', group_id: 'group-foreign' }),
          'labels.*.single': () => {
            updateReached = true
            return ok({ id: 'label-1' })
          },
        }),
      ),
    )

    const res = await patchItem(
      patchRequest('http://localhost/api/labels/items/label-1', { name: 'Hijacked' }),
      params('label-1'),
    )

    expect(updateReached).toBe(false)
    expect(res.status).toBe(403)
  })

  it('allows updating a label in a same-company group', async () => {
    createClientMock.mockResolvedValue(
      clientWithDb(
        sameCompanyDb({
          'labels.id, group_id.single': () => ok({ id: 'label-1', group_id: 'group-1' }),
          'labels.*.single': () => ok({ id: 'label-1', name: 'Renamed' }),
        }),
      ),
    )

    const res = await patchItem(
      patchRequest('http://localhost/api/labels/items/label-1', { name: 'Renamed' }),
      params('label-1'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ id: 'label-1', name: 'Renamed' })
  })
})

describe('DELETE /api/labels/items/[id] (P2-4)', () => {
  it('rejects deleting a label whose group is in a foreign company with 403 and never deletes', async () => {
    let deleteReached = false
    createClientMock.mockResolvedValue(
      clientWithDb(
        foreignCompanyDb({
          'labels.group_id.single': () => ok({ group_id: 'group-foreign' }),
          'labels.*.chain': () => {
            deleteReached = true
            return ok(null)
          },
        }),
      ),
    )

    const res = await deleteItem(
      deleteRequest('http://localhost/api/labels/items/label-1'),
      params('label-1'),
    )

    expect(deleteReached).toBe(false)
    expect(res.status).toBe(403)
  })

  it('allows deleting a label in a same-company group', async () => {
    createClientMock.mockResolvedValue(
      clientWithDb(
        sameCompanyDb({
          'labels.group_id.single': () => ok({ group_id: 'group-1' }),
          'labels.*.chain': () => ok(null),
        }),
      ),
    )

    const res = await deleteItem(
      deleteRequest('http://localhost/api/labels/items/label-1'),
      params('label-1'),
    )

    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/labels/groups/[id] (P2-4)', () => {
  it('rejects updating a foreign-company group with 403 and never updates', async () => {
    let updateReached = false
    createClientMock.mockResolvedValue(
      clientWithDb(
        foreignCompanyDb({
          'label_groups.id.single': () => ok({ id: 'group-foreign' }),
          'label_groups.*.single': () => {
            updateReached = true
            return ok({ id: 'group-foreign' })
          },
        }),
      ),
    )

    const res = await patchGroup(
      patchRequest('http://localhost/api/labels/groups/group-foreign', { name: 'X' }),
      params('group-foreign'),
    )

    expect(updateReached).toBe(false)
    expect(res.status).toBe(403)
  })

  it('allows updating a same-company group', async () => {
    createClientMock.mockResolvedValue(
      clientWithDb(
        sameCompanyDb({
          'label_groups.id.single': () => ok({ id: 'group-1' }),
          'label_groups.*.single': () => ok({ id: 'group-1', name: 'Renamed' }),
        }),
      ),
    )

    const res = await patchGroup(
      patchRequest('http://localhost/api/labels/groups/group-1', { name: 'Renamed' }),
      params('group-1'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ id: 'group-1', name: 'Renamed' })
  })
})

describe('DELETE /api/labels/groups/[id] (P2-4)', () => {
  it('rejects deleting a foreign-company group with 403 and never deletes', async () => {
    let deleteReached = false
    createClientMock.mockResolvedValue(
      clientWithDb(
        foreignCompanyDb({
          'label_groups.id.single': () => ok({ id: 'group-foreign' }),
          'label_groups.*.chain': () => {
            deleteReached = true
            return ok(null)
          },
        }),
      ),
    )

    const res = await deleteGroup(
      deleteRequest('http://localhost/api/labels/groups/group-foreign'),
      params('group-foreign'),
    )

    expect(deleteReached).toBe(false)
    expect(res.status).toBe(403)
  })

  it('allows deleting a same-company group', async () => {
    createClientMock.mockResolvedValue(
      clientWithDb(
        sameCompanyDb({
          'label_groups.id.single': () => ok({ id: 'group-1' }),
          'label_groups.*.chain': () => ok(null),
        }),
      ),
    )

    const res = await deleteGroup(
      deleteRequest('http://localhost/api/labels/groups/group-1'),
      params('group-1'),
    )

    expect(res.status).toBe(200)
  })
})

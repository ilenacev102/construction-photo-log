import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireProjectMutate, requireProjectAccess } from '../company-auth'

const USER_ID = 'user-1'
const PROJECT_ID = 'proj-1'

type RowResult = { data: unknown; error: unknown }

/**
 * Minimal fluent mock of the Supabase query builder used by company-auth.
 * Every chained call returns the same thenable chain; the terminal decides
 * the handler key:
 *   .single()        -> `${table}.single`
 *   .maybeSingle()   -> `${table}.maybeSingle`
 *   awaited w/o terminal (companyUsers list) -> `${table}.chain`
 */
function makeDb(handlers: Record<string, () => RowResult>) {
  const call = (key: string) => handlers[key]?.() ?? { data: null, error: null }
  const db = {
    from: (_table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        single: () => call(`${_table}.single`),
        maybeSingle: () => call(`${_table}.maybeSingle`),
        then: (resolve: (v: RowResult) => void) => resolve(call(`${_table}.chain`)),
      }
      return chain
    },
  }
  return db as unknown as SupabaseClient
}

function ok(data: unknown): RowResult {
  return { data, error: null }
}
function missing(): RowResult {
  return { data: null, error: new Error('not found') }
}

describe('requireProjectMutate (P1-7: VIEW grant does NOT authorize writes)', () => {
  it('allows an admin regardless of ownership', async () => {
    const db = makeDb({
      'profiles.single': () => ok({ company_name: 'Acme', role: 'admin' }),
      'projects.single': () => ok({ user_id: 'someone-else' }),
    })
    const res = await requireProjectMutate(db, USER_ID, PROJECT_ID)
    expect(res.ctx?.isAdmin).toBe(true)
  })

  it('allows the project owner with a null company context', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => ok({ user_id: USER_ID }),
    })
    await expect(requireProjectMutate(db, USER_ID, PROJECT_ID)).resolves.toEqual({ ctx: null })
  })

  it('forbids a VIEW-grant-only company-less user (P1-7 core case)', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => ok({ user_id: 'other-owner' }),
    })
    await expect(requireProjectMutate(db, USER_ID, PROJECT_ID)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('allows a same-company user', async () => {
    const db = makeDb({
      'profiles.single': () => ok({ company_name: 'Acme', role: 'worker' }),
      'profiles.chain': () => ok([{ id: 'other-owner' }, { id: USER_ID }]),
      'projects.single': () => ok({ user_id: 'other-owner' }),
    })
    await expect(requireProjectMutate(db, USER_ID, PROJECT_ID)).resolves.toMatchObject({
      ctx: { isAdmin: false },
    })
  })

  it('forbids a different-company user even with an explicit VIEW grant', async () => {
    const db = makeDb({
      'profiles.single': () => ok({ company_name: 'Rival', role: 'worker' }),
      'profiles.chain': () => ok([{ id: USER_ID }]),
      'projects.single': () => ok({ user_id: 'acme-owner' }),
    })
    await expect(requireProjectMutate(db, USER_ID, PROJECT_ID)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('forbids when the project does not exist', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => missing(),
    })
    await expect(requireProjectMutate(db, USER_ID, PROJECT_ID)).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('requireProjectAccess (read-only check keeps VIEW grants)', () => {
  it('allows a company-less owner', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => ok({ user_id: USER_ID }),
    })
    await expect(requireProjectAccess(db, USER_ID, PROJECT_ID)).resolves.toEqual({ ctx: null })
  })

  it('allows a company-less user with an explicit VIEW grant', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => ok({ user_id: 'other-owner' }),
      'user_permissions.maybeSingle': () => ok({ granted: true }),
    })
    await expect(requireProjectAccess(db, USER_ID, PROJECT_ID)).resolves.toEqual({ ctx: null })
  })

  it('forbids a company-less user without a grant', async () => {
    const db = makeDb({
      'profiles.single': () => missing(),
      'projects.single': () => ok({ user_id: 'other-owner' }),
      'user_permissions.maybeSingle': () => ok({ granted: false }),
    })
    await expect(requireProjectAccess(db, USER_ID, PROJECT_ID)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('allows a same-company user via company membership', async () => {
    const db = makeDb({
      'profiles.single': () => ok({ company_name: 'Acme', role: 'worker' }),
      'profiles.chain': () => ok([{ id: 'owner' }, { id: USER_ID }]),
      'projects.single': () => ok({ user_id: 'owner' }),
      'user_permissions.maybeSingle': () => ok({ granted: false }),
    })
    await expect(requireProjectAccess(db, USER_ID, PROJECT_ID)).resolves.toMatchObject({
      ctx: { isAdmin: false },
    })
  })
})

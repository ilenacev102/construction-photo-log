import { describe, it, expect } from 'vitest'

// ============================================================================
// Pure models of the RLS invariants in
// 20260827000001_fix_comments_cross_tenant.sql
//
// The fixed INSERT/UPDATE policies on `comments` require BOTH:
//   1. auth.uid() = user_id            (authorship)
//   2. user_can_access_project(entity's project_id)  (project scope)
//
// Before the fix, condition (2) was missing, so any authenticated user could
// write comments on any company's entities (cross-tenant write).
// ============================================================================

type EntityType = 'photo' | 'defect' | 'work_order' | string

type EntityDirectory = {
  photos: Record<string, string> // entity_id -> project_id
  defects: Record<string, string>
  work_orders: Record<string, string>
}

/**
 * Model of the polymorphic CASE in the policy: resolves the parent entity's
 * project_id. Returns null for unknown entity types or missing entities,
 * which matches no project row, so the policy fails closed (deny).
 */
function resolveEntityProject(
  entityType: EntityType,
  entityId: string,
  directory: EntityDirectory,
): string | null {
  switch (entityType) {
    case 'photo':
      return directory.photos[entityId] ?? null
    case 'defect':
      return directory.defects[entityId] ?? null
    case 'work_order':
      return directory.work_orders[entityId] ?? null
    default:
      return null
  }
}

/** Model of public.user_can_access_project: owner | same company | grant. */
function userCanAccessProject(
  projectId: string | null,
  accessibleProjectIds: Set<string>,
): boolean {
  if (projectId === null) return false
  return accessibleProjectIds.has(projectId)
}

/** Model of the fixed INSERT policy WITH CHECK. */
function canInsertComment(args: {
  callerId: string
  rowUserId: string
  entityType: EntityType
  entityId: string
  directory: EntityDirectory
  accessibleProjectIds: Set<string>
}): boolean {
  if (args.callerId !== args.rowUserId) return false
  const projectId = resolveEntityProject(args.entityType, args.entityId, args.directory)
  return userCanAccessProject(projectId, args.accessibleProjectIds)
}

/** Model of the fixed UPDATE policy (USING checks scope, WITH CHECK authorship). */
function canUpdateComment(args: {
  callerId: string
  rowUserId: string
  entityType: EntityType
  entityId: string
  directory: EntityDirectory
  accessibleProjectIds: Set<string>
}): boolean {
  return canInsertComment(args)
}

const CALLER = 'user-1'
const FOREIGN_USER = 'user-2'

const directory: EntityDirectory = {
  photos: { 'photo-own': 'project-a', 'photo-foreign': 'project-b' },
  defects: { 'defect-own': 'project-a', 'defect-foreign': 'project-b' },
  work_orders: { 'wo-own': 'project-a', 'wo-foreign': 'project-b' },
}

// Caller can access project-a only (owner / same company / grant).
const accessible = new Set(['project-a'])

describe('comments cross-tenant RLS invariants (20260827000001)', () => {
  it('allows INSERT on own-project photo/defect/work_order', () => {
    for (const [entityType, entityId] of [
      ['photo', 'photo-own'],
      ['defect', 'defect-own'],
      ['work_order', 'wo-own'],
    ] as const) {
      expect(
        canInsertComment({
          callerId: CALLER,
          rowUserId: CALLER,
          entityType,
          entityId,
          directory,
          accessibleProjectIds: accessible,
        }),
      ).toBe(true)
    }
  })

  it('denies INSERT on foreign-project entities (the fixed hole)', () => {
    for (const [entityType, entityId] of [
      ['photo', 'photo-foreign'],
      ['defect', 'defect-foreign'],
      ['work_order', 'wo-foreign'],
    ] as const) {
      expect(
        canInsertComment({
          callerId: CALLER,
          rowUserId: CALLER,
          entityType,
          entityId,
          directory,
          accessibleProjectIds: accessible,
        }),
      ).toBe(false)
    }
  })

  it('denies INSERT impersonating another user even on own project', () => {
    expect(
      canInsertComment({
        callerId: CALLER,
        rowUserId: FOREIGN_USER,
        entityType: 'photo',
        entityId: 'photo-own',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(false)
  })

  it('denies INSERT for unknown entity types and missing entities (fail-closed)', () => {
    expect(
      canInsertComment({
        callerId: CALLER,
        rowUserId: CALLER,
        entityType: 'invoice',
        entityId: 'whatever',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(false)
    expect(
      canInsertComment({
        callerId: CALLER,
        rowUserId: CALLER,
        entityType: 'photo',
        entityId: 'photo-missing',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(false)
  })

  it('denies UPDATE on foreign-project entities, allows own-project', () => {
    expect(
      canUpdateComment({
        callerId: CALLER,
        rowUserId: CALLER,
        entityType: 'defect',
        entityId: 'defect-foreign',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(false)
    expect(
      canUpdateComment({
        callerId: CALLER,
        rowUserId: CALLER,
        entityType: 'defect',
        entityId: 'defect-own',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(true)
  })

  it('denies UPDATE of another user\u2019s comment even on own project', () => {
    expect(
      canUpdateComment({
        callerId: CALLER,
        rowUserId: FOREIGN_USER,
        entityType: 'photo',
        entityId: 'photo-own',
        directory,
        accessibleProjectIds: accessible,
      }),
    ).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ============================================================================
// Invariants of 20261022000001_harden_tenant_isolation.sql (parsed from SQL).
//
// Root cause this guards against: every write policy used
// user_can_access_project(...) — the READ helper — which also matches the
// `project.VIEW.<id>` grant handed to read-only subcontractors. The write
// policies must use user_can_mutate_project(...), which has no grant branch.
//
// The migration files are the source of truth; earlier migrations are history
// and are superseded by this file, so the assertions below read only this file.
// ============================================================================

const migrationPath = resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '20261022000001_harden_tenant_isolation.sql',
)

/** SQL with `--` comments removed, so prose cannot satisfy an assertion. */
const sql = readFileSync(migrationPath, 'utf8').replace(/--[^\n]*/g, '')

const WRITE_TABLES = [
  'public.photos',
  'public.daily_logs',
  'public.site_schemas',
  'public.drawing_pins',
  'public.comments',
  'public.schema_photo_pins',
  'storage.objects',
]

type Policy = { name: string; table: string; cmd: string; body: string }

/** Parses `create policy "<name>" on <table> for <cmd> ... ;` blocks. */
function parsePolicies(source: string): Policy[] {
  const re =
    /create\s+policy\s+"([^"]+)"\s+on\s+([\w.]+)\s+for\s+(select|insert|update|delete|all)\b([\s\S]*?);/gi
  return [...source.matchAll(re)].map((m) => ({
    name: m[1],
    table: m[2].toLowerCase(),
    cmd: m[3].toLowerCase(),
    body: m[4],
  }))
}

/** Full text of `create or replace function public.<name>(...) ... $$;`. */
function functionBody(source: string, name: string): string | null {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`,
    'i',
  )
  const match = source.match(re)
  return match ? match[0] : null
}

const policies = parsePolicies(sql)

describe('tenant isolation invariants (20261022000001)', () => {
  it('parses the migration file', () => {
    expect(sql.length).toBeGreaterThan(1000)
    expect(policies.length).toBeGreaterThan(0)
  })

  it('user_can_access_project keeps the non-empty company_name guard', () => {
    const body = functionBody(sql, 'user_can_access_project')
    expect(body).toBeTruthy()
    expect(body).toMatch(/company_name\s*<>\s*''/)
    expect(body).toMatch(/security\s+definer/i)
    expect(body).toMatch(/search_path\s*=\s*''/i)
  })

  it('user_can_mutate_project exists, excludes clients, and has no VIEW-grant branch', () => {
    const body = functionBody(sql, 'user_can_mutate_project')
    expect(body).toBeTruthy()
    expect(body).toMatch(/company_name\s*<>\s*''/)
    expect(body).toMatch(/role\s*<>\s*'client'/)
    expect(body).not.toMatch(/permission_key/)
    expect(body).not.toMatch(/project\.VIEW/)
    expect(body).toMatch(/security\s+definer/i)
    expect(body).toMatch(/search_path\s*=\s*''/i)
  })

  it('no write policy on the write tables uses the read helper', () => {
    const offenders = policies.filter(
      (p) =>
        WRITE_TABLES.includes(p.table) &&
        p.cmd !== 'select' &&
        /user_can_access_project/.test(p.body),
    )
    expect(offenders).toEqual([])
  })

  it('every recreated write policy is gated by user_can_mutate_project', () => {
    const writePolicies = policies.filter(
      (p) => WRITE_TABLES.includes(p.table) && p.cmd !== 'select',
    )
    expect(writePolicies.length).toBeGreaterThanOrEqual(18)
    for (const policy of writePolicies) {
      expect(policy.body).toMatch(/user_can_mutate_project/)
    }
  })

  it('leaves attendance_logs writes untouched (invited check-ins stay on the read helper)', () => {
    const attendance = policies.filter((p) => p.table === 'public.attendance_logs')
    expect(attendance).toEqual([])
  })

  it('every UPDATE policy repeats the new-row predicate in WITH CHECK', () => {
    const updates = policies.filter((p) => p.cmd === 'update')
    expect(updates.length).toBeGreaterThanOrEqual(5)
    for (const policy of updates) {
      expect(policy.body).toMatch(/with\s+check/i)
      const withCheck = policy.body.split(/with\s+check/i)[1] ?? ''
      expect(withCheck).toMatch(/user_can_mutate_project/)
    }
  })

  it('sweeps leftover non-SELECT policies that still reference the read helper', () => {
    expect(sql).toMatch(/from\s+pg_policies/i)
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+%I\s+on\s+%I\.%I/i)
    // attendance_logs INSERT must be exempt from the sweep.
    expect(sql).toMatch(/tablename\s*=\s*'attendance_logs'\s*\n?\s*and\s+cmd\s*=\s*'INSERT'/i)
  })

  it('revokes EXECUTE on the permission/preset RPCs and keeps service_role working', () => {
    for (const fn of [
      'seed_default_labels(uuid)',
      'get_user_permissions(uuid)',
      'user_has_permission(uuid, text)',
    ]) {
      expect(sql).toMatch(
        new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn.replace(/[()]/g, '\\$&')}\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'),
      )
      expect(sql).toMatch(
        new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn.replace(/[()]/g, '\\$&')}\\s+to\\s+service_role`, 'i'),
      )
    }
  })

  it('guards the two permission RPCs against reading other tenants', () => {
    for (const name of ['get_user_permissions', 'user_has_permission']) {
      const body = functionBody(sql, name)
      expect(body).toBeTruthy()
      expect(body).toMatch(/service_role/)
      expect(body).toMatch(/role\s*=\s*'admin'/)
      expect(body).toMatch(/role\s*=\s*'site_manager'/)
      expect(body).toMatch(/company_name\s*<>\s*''/)
    }
    const seed = functionBody(sql, 'seed_default_labels')
    expect(seed).toMatch(/raise\s+exception/i)
    expect(seed).toMatch(/errcode\s*=\s*'42501'/)
  })
})

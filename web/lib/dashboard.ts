/**
 * Dashboard constants — Manager Dashboard.
 *
 * Named thresholds, limits, and predicate helpers extracted from
 * app/[locale]/dashboard/manager/page.tsx so the values live in one
 * testable location.
 */

import type { DefectSeverity, DefectStatus } from '@/types/database'

// ---------------------------------------------------------------------------
// Status sets
// ---------------------------------------------------------------------------

/** Statuses treated as "open" on the manager dashboard. */
export const OPEN_DEFECT_STATUSES: readonly DefectStatus[] = ['open', 'in_progress']

/** Statuses that indicate a defect is no longer active. */
export const RESOLVED_DEFECT_STATUSES: readonly DefectStatus[] = ['resolved', 'closed']

// ---------------------------------------------------------------------------
// Severity constants
// ---------------------------------------------------------------------------

/** Severity level that flags a defect as critical. */
export const CRITICAL_SEVERITY: DefectSeverity = 'critical'

// ---------------------------------------------------------------------------
// Fetch / display limits
// ---------------------------------------------------------------------------

/** Max attendance records fetched for the dashboard summary. */
export const ATTENDANCE_FETCH_LIMIT = 200

/** Max audit-log records fetched for the recent-activity feed. */
export const AUDIT_LOG_FETCH_LIMIT = 10

/** Number of audit-log entries shown in the "Recent Activity" table. */
export const RECENT_AUDIT_LOG_COUNT = 5

/** Max attendance rows rendered in today's attendance list. */
export const TODAY_ATTENDANCE_SLICE = 8

/** Characters shown when truncating a user_id for display. */
export const USER_ID_PREFIX_LENGTH = 8

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

interface HasSeverityStatus {
  severity: DefectSeverity
  status: DefectStatus
}

/** Returns `true` when a defect's status is in OPEN_DEFECT_STATUSES. */
export function isOpenDefect(d: HasSeverityStatus): boolean {
  return (OPEN_DEFECT_STATUSES as readonly string[]).includes(d.status)
}

/** Returns `true` when a defect is critical and not resolved/closed. */
export function isCriticalDefect(d: HasSeverityStatus): boolean {
  return (
    d.severity === CRITICAL_SEVERITY &&
    !(RESOLVED_DEFECT_STATUSES as readonly string[]).includes(d.status)
  )
}

import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_FETCH_LIMIT,
  AUDIT_LOG_FETCH_LIMIT,
  CRITICAL_SEVERITY,
  OPEN_DEFECT_STATUSES,
  RECENT_AUDIT_LOG_COUNT,
  RESOLVED_DEFECT_STATUSES,
  TODAY_ATTENDANCE_SLICE,
  USER_ID_PREFIX_LENGTH,
  isOpenDefect,
  isCriticalDefect,
} from '@/lib/dashboard'
import type { DefectSeverity, DefectStatus } from '@/types/database'

/**
 * Unit tests — Manager Dashboard constants (audit #9д).
 *
 * Mirrors the style of lib/__tests__/risk-score.test.ts: import from
 * @/lib/dashboard, value assertions on every exported constant, and
 * behaviour tests for the predicate helpers.
 */

// --- helpers ----------------------------------------------------------------

type HasSeverityStatus = { severity: DefectSeverity; status: DefectStatus }

function defect(
  severity: DefectSeverity,
  status: DefectStatus,
): HasSeverityStatus {
  return { severity, status }
}

// --- constant values --------------------------------------------------------

describe('constant values', () => {
  it('OPEN_DEFECT_STATUSES contains "open" and "in_progress"', () => {
    expect(OPEN_DEFECT_STATUSES).toEqual(['open', 'in_progress'])
  })

  it('RESOLVED_DEFECT_STATUSES contains "resolved" and "closed"', () => {
    expect(RESOLVED_DEFECT_STATUSES).toEqual(['resolved', 'closed'])
  })

  it('CRITICAL_SEVERITY is "critical"', () => {
    expect(CRITICAL_SEVERITY).toBe('critical')
  })

  it('ATTENDANCE_FETCH_LIMIT is 200', () => {
    expect(ATTENDANCE_FETCH_LIMIT).toBe(200)
  })

  it('AUDIT_LOG_FETCH_LIMIT is 10', () => {
    expect(AUDIT_LOG_FETCH_LIMIT).toBe(10)
  })

  it('RECENT_AUDIT_LOG_COUNT is 5', () => {
    expect(RECENT_AUDIT_LOG_COUNT).toBe(5)
  })

  it('TODAY_ATTENDANCE_SLICE is 8', () => {
    expect(TODAY_ATTENDANCE_SLICE).toBe(8)
  })

  it('USER_ID_PREFIX_LENGTH is 8', () => {
    expect(USER_ID_PREFIX_LENGTH).toBe(8)
  })
})

// --- isOpenDefect ------------------------------------------------------------

describe('isOpenDefect', () => {
  it('returns true for status "open"', () => {
    expect(isOpenDefect(defect('low', 'open'))).toBe(true)
  })

  it('returns true for status "in_progress"', () => {
    expect(isOpenDefect(defect('medium', 'in_progress'))).toBe(true)
  })

  it('returns false for status "resolved"', () => {
    expect(isOpenDefect(defect('critical', 'resolved'))).toBe(false)
  })

  it('returns false for status "closed"', () => {
    expect(isOpenDefect(defect('high', 'closed'))).toBe(false)
  })

  it('returns false for status "rejected"', () => {
    expect(isOpenDefect(defect('low', 'rejected'))).toBe(false)
  })
})

// --- isCriticalDefect -------------------------------------------------------

describe('isCriticalDefect', () => {
  it('returns true for critical + open', () => {
    expect(isCriticalDefect(defect('critical', 'open'))).toBe(true)
  })

  it('returns true for critical + in_progress', () => {
    expect(isCriticalDefect(defect('critical', 'in_progress'))).toBe(true)
  })

  it('returns true for critical + rejected', () => {
    expect(isCriticalDefect(defect('critical', 'rejected'))).toBe(true)
  })

  it('returns false for critical + resolved', () => {
    expect(isCriticalDefect(defect('critical', 'resolved'))).toBe(false)
  })

  it('returns false for critical + closed', () => {
    expect(isCriticalDefect(defect('critical', 'closed'))).toBe(false)
  })

  it('returns false for non-critical severities', () => {
    expect(isCriticalDefect(defect('high', 'open'))).toBe(false)
    expect(isCriticalDefect(defect('medium', 'open'))).toBe(false)
    expect(isCriticalDefect(defect('low', 'open'))).toBe(false)
  })
})

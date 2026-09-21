import { describe, expect, it } from 'vitest'
import { attendanceInsights, formatDuration, BUCKET_DAYS } from '@/lib/attendance-insights'
import type { AttendanceLog } from '@/types/database'

function makeLog(
  id: string,
  checkIn: string,
  durationMinutes: number | null,
): AttendanceLog {
  return {
    id,
    project_id: 'p1',
    user_id: 'u1',
    check_in: checkIn,
    check_out: null,
    duration_minutes: durationMinutes,
    note: '',
    created_at: checkIn,
  }
}

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(510)).toBe('8h 30m')
    expect(formatDuration(60)).toBe('1h 0m')
  })

  it('formats sub-hour durations', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('returns -- for null and zero', () => {
    expect(formatDuration(null)).toBe('--')
    expect(formatDuration(0)).toBe('--')
  })
})

describe('attendanceInsights', () => {
  it('returns zeroed stats for empty input', () => {
    const insights = attendanceInsights([])
    expect(insights.totalMinutes).toBe(0)
    expect(insights.totalDays).toBe(0)
    expect(insights.avgMinutes).toBeNull()
    expect(insights.longestMinutes).toBeNull()
    expect(insights.dayBuckets).toHaveLength(BUCKET_DAYS)
  })

  it('sums total minutes and counts distinct days', () => {
    const logs = [
      makeLog('l1', '2026-07-01T08:00:00.000Z', 480),
      makeLog('l2', '2026-07-01T13:00:00.000Z', 240),
      makeLog('l3', '2026-07-02T08:00:00.000Z', 360),
    ]
    const insights = attendanceInsights(logs)
    expect(insights.totalMinutes).toBe(1080)
    expect(insights.totalDays).toBe(2)
  })

  it('computes average and longest duration', () => {
    const logs = [
      makeLog('l1', '2026-07-01T08:00:00.000Z', 480),
      makeLog('l2', '2026-07-02T08:00:00.000Z', 360),
      makeLog('l3', '2026-07-03T08:00:00.000Z', 600),
    ]
    const insights = attendanceInsights(logs)
    expect(insights.avgMinutes).toBe(480)
    expect(insights.longestMinutes).toBe(600)
  })

  it('ignores logs without a duration', () => {
    const logs = [
      makeLog('l1', '2026-07-01T08:00:00.000Z', null),
      makeLog('l2', '2026-07-02T08:00:00.000Z', 0),
    ]
    const insights = attendanceInsights(logs)
    expect(insights.totalMinutes).toBe(0)
    expect(insights.totalDays).toBe(0)
  })

  it('places durations in the correct day bucket', () => {
    const now = new Date('2026-07-10T12:00:00.000Z')
    const logs = [makeLog('l1', '2026-07-10T08:00:00.000Z', 480)]
    const insights = attendanceInsights(logs, now)
    const last = insights.dayBuckets[insights.dayBuckets.length - 1]
    expect(last.date).toBe('2026-07-10')
    expect(last.minutes).toBe(480)
    // All earlier buckets are zero-filled.
    expect(insights.dayBuckets.slice(0, -1).every((d) => d.minutes === 0)).toBe(true)
  })
})

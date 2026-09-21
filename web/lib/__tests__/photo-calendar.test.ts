import { describe, it, expect } from 'vitest'
import {
  toDayKey,
  groupPhotosByDay,
  buildCalendarGrid,
  applyCounts,
  maxDailyCount,
  intensityForCount,
} from '../photo-calendar'
import type { Photo } from '@/types/database'

function makePhoto(id: string, takenAt: string | null): Photo {
  return {
    id,
    project_id: 'p1',
    image_url: `https://example.com/${id}.jpg`,
    note: null,
    taken_at: takenAt,
    latitude: null,
    longitude: null,
    created_at: takenAt ?? '2026-01-01T00:00:00.000Z',
    trade_metadata: null,
  }
}

describe('toDayKey', () => {
  it('formats a local day key from an ISO timestamp', () => {
    expect(toDayKey('2026-08-04T12:00:00.000Z', 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('zero-pads month and day', () => {
    const key = toDayKey('2026-01-05T08:00:00.000Z', 'UTC')
    const [year, month, day] = key.split('-')
    expect(year).toBe('2026')
    expect(month).toBe('01')
    expect(day).toBe('05')
  })
})

describe('groupPhotosByDay', () => {
  it('groups photos by local day key', () => {
    const photos = [
      makePhoto('a', '2026-08-04T10:00:00.000Z'),
      makePhoto('b', '2026-08-04T18:00:00.000Z'),
      makePhoto('c', '2026-08-05T09:00:00.000Z'),
    ]
    const buckets = groupPhotosByDay(photos, 'UTC')
    expect(buckets.size).toBe(2)
    expect(buckets.get('2026-08-04')?.length).toBe(2)
    expect(buckets.get('2026-08-05')?.length).toBe(1)
  })

  it('skips photos without taken_at', () => {
    const photos = [makePhoto('a', null), makePhoto('b', '2026-08-04T10:00:00.000Z')]
    const buckets = groupPhotosByDay(photos, 'UTC')
    expect(buckets.size).toBe(1)
  })
})

describe('buildCalendarGrid', () => {
  it('builds weeks starting on Sunday and covering the range', () => {
    // 2026-08-04 is a Tuesday
    const start = new Date(Date.UTC(2026, 7, 4))
    const end = new Date(Date.UTC(2026, 7, 4))
    const grid = buildCalendarGrid(start, end, 'UTC')
    // One partial week: first cell (Sunday) is padding, Tuesday is in range.
    expect(grid.length).toBe(1)
    const week = grid[0]
    expect(week.length).toBe(7)
    expect(week[0].key).toBeNull()
    expect(week[1].key).toBeNull()
    expect(week[2].key).not.toBeNull() // Tuesday
    expect(week[3].key).toBeNull()
  })

  it('spans multiple weeks for a longer range', () => {
    const start = new Date(Date.UTC(2026, 7, 1))
    const end = new Date(Date.UTC(2026, 7, 31))
    const grid = buildCalendarGrid(start, end, 'UTC')
    // August 2026: 31 days starting Saturday → 5-6 weeks.
    expect(grid.length).toBeGreaterThanOrEqual(5)
    expect(grid.length).toBeLessThanOrEqual(6)
  })
})

describe('applyCounts + maxDailyCount', () => {
  it('fills counts from buckets and reports the max', () => {
    const start = new Date(Date.UTC(2026, 7, 3)) // Monday
    const end = new Date(Date.UTC(2026, 7, 9)) // Sunday
    const grid = buildCalendarGrid(start, end, 'UTC')
    const buckets = groupPhotosByDay(
      [
        makePhoto('a', '2026-08-04T10:00:00.000Z'),
        makePhoto('b', '2026-08-04T12:00:00.000Z'),
        makePhoto('c', '2026-08-07T08:00:00.000Z'),
      ],
      'UTC',
    )
    const filled = applyCounts(grid, buckets)
    expect(maxDailyCount(filled)).toBe(2)

    const tuesday = filled[0][2]
    expect(tuesday.count).toBe(2)
    const friday = filled[0][5]
    expect(friday.count).toBe(1)
    const sunday = filled[0][6]
    expect(sunday.count).toBe(0)
  })
})

describe('intensityForCount', () => {
  it('returns 0 for empty days', () => {
    expect(intensityForCount(0, 10)).toBe(0)
    expect(intensityForCount(0, 0)).toBe(0)
  })

  it('scales 1-4 relative to the max', () => {
    expect(intensityForCount(10, 10)).toBe(4)
    expect(intensityForCount(8, 10)).toBe(4)
    expect(intensityForCount(6, 10)).toBe(3)
    expect(intensityForCount(5, 10)).toBe(3)
    expect(intensityForCount(3, 10)).toBe(2)
    expect(intensityForCount(1, 10)).toBe(1)
  })
})

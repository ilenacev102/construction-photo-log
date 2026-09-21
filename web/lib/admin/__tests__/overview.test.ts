import { describe, it, expect } from 'vitest'
import { buildAttentionItems, computeUsageMeters } from '../overview'
import type { UsageMeter } from '../overview'

describe('computeUsageMeters', () => {
  it('marks every meter unlimited with ok tier regardless of usage', () => {
    const meters = computeUsageMeters({
      totalUsers: 999,
      totalPhotos: 99999,
      totalProjects: 999,
    })

    expect(meters).toHaveLength(3)
    for (const m of meters) {
      expect(m.unlimited).toBe(true)
      expect(m.limit).toBeNull()
      expect(m.percent).toBe(0)
      expect(m.tier).toBe('ok')
    }
    const byKey = Object.fromEntries(meters.map((m) => [m.key, m]))
    expect(byKey.seats.used).toBe(999)
    expect(byKey.photos.used).toBe(99999)
    expect(byKey.projects.used).toBe(999)
  })
})

describe('buildAttentionItems', () => {
  it('returns no items when all meters are unlimited', () => {
    const meters = computeUsageMeters({
      totalUsers: 500,
      totalPhotos: 50_000,
      totalProjects: 100,
    })

    expect(buildAttentionItems(meters)).toEqual([])
  })

  it('creates a critical reached item at 100% usage', () => {
    const meters: UsageMeter[] = [
      { key: 'seats', used: 25, limit: 25, unlimited: false, percent: 100, tier: 'critical' },
    ]

    expect(buildAttentionItems(meters)).toContainEqual(
      expect.objectContaining({
        kind: 'seats-reached',
        severity: 'critical',
        used: 25,
        limit: 25,
      }),
    )
  })

  it('creates a warning near item at >=80% usage with the percent attached', () => {
    const meters: UsageMeter[] = [
      { key: 'seats', used: 4, limit: 5, unlimited: false, percent: 80, tier: 'warning' },
    ]

    expect(buildAttentionItems(meters)).toContainEqual(
      expect.objectContaining({
        kind: 'seats-near',
        severity: 'warning',
        used: 4,
        limit: 5,
        percent: 80,
      }),
    )
  })

  it('skips unlimited meters entirely', () => {
    const meters: UsageMeter[] = [
      { key: 'seats', used: 999, limit: null, unlimited: true, percent: 0, tier: 'ok' },
      { key: 'photos', used: 8, limit: 10, unlimited: false, percent: 80, tier: 'warning' },
    ]

    const items = buildAttentionItems(meters)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('photos-near')
  })

  it('sorts critical before warning', () => {
    const meters: UsageMeter[] = [
      { key: 'photos', used: 9_000, limit: 10_000, unlimited: false, percent: 90, tier: 'warning' },
      { key: 'seats', used: 25, limit: 25, unlimited: false, percent: 100, tier: 'critical' },
    ]
    const items = buildAttentionItems(meters)

    const severities = items.map((i) => i.severity)
    const order = { critical: 0, warning: 1, info: 2 } as const
    const sorted = [...severities].sort((a, b) => order[a] - order[b])
    expect(severities).toEqual(sorted)
    // seats reached (critical, 25/25) must lead even though photos came first
    expect(items[0].kind).toBe('seats-reached')
  })
})

import { describe, expect, it } from 'vitest'
import { agingBreakdown, agingTierFor, daysOpen } from '@/lib/defect-aging'
import type { Defect } from '@/types/database'

function makeDefect(id: string, status: Defect['status'], createdAt: string): Defect {
  return {
    id,
    project_id: 'p1',
    created_by: 'u1',
    assigned_to: null,
    title: `Defect ${id}`,
    description: '',
    severity: 'medium',
    status,
    location: '',
    photo_ids: [],
    due_date: null,
    resolved_at: null,
    resolution_notes: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
}

const NOW = new Date('2026-07-01T12:00:00.000Z')

describe('daysOpen', () => {
  it('counts whole days since creation', () => {
    const defect = makeDefect('d1', 'open', '2026-06-20T08:00:00.000Z')
    expect(daysOpen(defect, NOW)).toBe(11)
  })

  it('is 0 for defects created today', () => {
    const defect = makeDefect('d1', 'open', '2026-07-01T08:00:00.000Z')
    expect(daysOpen(defect, NOW)).toBe(0)
  })

  it('never goes negative for future timestamps', () => {
    const defect = makeDefect('d1', 'open', '2026-07-05T08:00:00.000Z')
    expect(daysOpen(defect, NOW)).toBe(0)
  })

  it('returns 0 for invalid dates', () => {
    const defect = makeDefect('d1', 'open', 'not-a-date')
    expect(daysOpen(defect, NOW)).toBe(0)
  })
})

describe('agingTierFor', () => {
  it('maps under 7 days to fresh', () => {
    expect(agingTierFor(0)).toBe('fresh')
    expect(agingTierFor(6)).toBe('fresh')
  })

  it('maps 7-13 days to warning', () => {
    expect(agingTierFor(7)).toBe('warning')
    expect(agingTierFor(13)).toBe('warning')
  })

  it('maps 14+ days to overdue', () => {
    expect(agingTierFor(14)).toBe('overdue')
    expect(agingTierFor(100)).toBe('overdue')
  })
})

describe('agingBreakdown', () => {
  it('returns empty stats when there are no active defects', () => {
    const defects = [makeDefect('d1', 'resolved', '2026-01-01T00:00:00.000Z')]
    const breakdown = agingBreakdown(defects, NOW)
    expect(breakdown.items).toEqual([])
    expect(breakdown.oldestDays).toBeNull()
    expect(breakdown.avgDays).toBeNull()
    expect(breakdown.counts).toEqual({ fresh: 0, warning: 0, overdue: 0 })
  })

  it('ignores resolved and closed defects', () => {
    const defects = [
      makeDefect('open1', 'open', '2026-06-25T00:00:00.000Z'),
      makeDefect('ip1', 'in_progress', '2026-06-26T00:00:00.000Z'),
      makeDefect('res1', 'resolved', '2026-05-01T00:00:00.000Z'),
      makeDefect('closed1', 'closed', '2026-05-02T00:00:00.000Z'),
      makeDefect('rej1', 'rejected', '2026-05-03T00:00:00.000Z'),
    ]
    const breakdown = agingBreakdown(defects, NOW)
    expect(breakdown.items).toHaveLength(2)
  })

  it('sorts active defects oldest first', () => {
    const defects = [
      makeDefect('young', 'open', '2026-06-29T00:00:00.000Z'),
      makeDefect('old', 'open', '2026-05-01T00:00:00.000Z'),
      makeDefect('mid', 'in_progress', '2026-06-15T00:00:00.000Z'),
    ]
    const breakdown = agingBreakdown(defects, NOW)
    expect(breakdown.items.map((i) => i.defect.id)).toEqual(['old', 'mid', 'young'])
    expect(breakdown.oldestDays).toBe(61)
    expect(breakdown.avgDays).toBe(Math.round((61 + 16 + 2) / 3))
  })

  it('tallies tier counts', () => {
    const defects = [
      makeDefect('fresh', 'open', '2026-06-30T00:00:00.000Z'),
      makeDefect('warning', 'open', '2026-06-20T00:00:00.000Z'),
      makeDefect('overdue', 'in_progress', '2026-05-01T00:00:00.000Z'),
    ]
    const breakdown = agingBreakdown(defects, NOW)
    expect(breakdown.counts).toEqual({ fresh: 1, warning: 1, overdue: 1 })
  })
})

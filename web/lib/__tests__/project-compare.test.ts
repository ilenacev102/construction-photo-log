import { describe, expect, it } from 'vitest'
import {
  computeProjectStats,
  healthScoreFor,
  healthTierFor,
} from '@/lib/project-compare'
import type { Defect, Photo } from '@/types/database'

function makePhoto(id: string, projectId: string, takenAt: string | null): Photo {
  return {
    id,
    project_id: projectId,
    image_url: `https://example.com/${id}.jpg`,
    note: null,
    taken_at: takenAt,
    latitude: null,
    longitude: null,
    created_at: takenAt ?? '2026-01-01T00:00:00.000Z',
    trade_metadata: null,
  }
}

function makeDefect(id: string, projectId: string, status: Defect['status']): Defect {
  return {
    id,
    project_id: projectId,
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
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

const NOW = new Date('2026-07-01T12:00:00.000Z')

describe('healthScoreFor', () => {
  it('starts at 100 with no defects', () => {
    expect(healthScoreFor([])).toBe(100)
  })

  it('penalizes open defects by 8 and in-progress by 4', () => {
    const defects = [
      makeDefect('d1', 'p1', 'open'),
      makeDefect('d2', 'p1', 'open'),
      makeDefect('d3', 'p1', 'in_progress'),
    ]
    expect(healthScoreFor(defects)).toBe(100 - 16 - 4)
  })

  it('never goes below zero', () => {
    const defects = Array.from({ length: 20 }, (_, i) =>
      makeDefect(`d${i}`, 'p1', 'open'),
    )
    expect(healthScoreFor(defects)).toBe(0)
  })

  it('handles empty, extreme and clamped scores safely', () => {
    expect(healthScoreFor([])).toBe(100)
    const singleDefect = [makeDefect('d1', 'p1', 'open')]
    expect(healthScoreFor(singleDefect)).toBe(92)
  })
})

describe('healthTierFor', () => {
  it('maps 75+ to healthy', () => {
    expect(healthTierFor(75)).toBe('healthy')
    expect(healthTierFor(100)).toBe('healthy')
  })

  it('maps 45-74 to atRisk', () => {
    expect(healthTierFor(74)).toBe('atRisk')
    expect(healthTierFor(45)).toBe('atRisk')
  })

  it('maps below 45 to critical', () => {
    expect(healthTierFor(44)).toBe('critical')
    expect(healthTierFor(0)).toBe('critical')
  })
})

describe('computeProjectStats', () => {
  it('returns empty stats for a project with no data', () => {
    const stats = computeProjectStats('p1', [], [], NOW)
    expect(stats).toEqual({
      projectId: 'p1',
      photoCount: 0,
      activeDays: 0,
      openDefects: 0,
      inProgressDefects: 0,
      resolvedDefects: 0,
      healthScore: 100,
      healthTier: 'healthy',
      photosLast30Days: 0,
      firstPhotoDate: null,
      lastPhotoDate: null,
    })
  })

  it('only counts photos belonging to the project', () => {
    const photos = [
      makePhoto('ph1', 'p1', '2026-06-01T08:00:00.000Z'),
      makePhoto('ph2', 'p2', '2026-06-01T09:00:00.000Z'),
    ]
    const stats = computeProjectStats('p1', photos, [], NOW)
    expect(stats.photoCount).toBe(1)
    expect(stats.activeDays).toBe(1)
  })

  it('counts unique days and ignores photos without taken_at', () => {
    const photos = [
      makePhoto('ph1', 'p1', '2026-06-01T08:00:00.000Z'),
      makePhoto('ph2', 'p1', '2026-06-01T18:00:00.000Z'),
      makePhoto('ph3', 'p1', '2026-06-02T08:00:00.000Z'),
      makePhoto('ph4', 'p1', null),
    ]
    const stats = computeProjectStats('p1', photos, [], NOW)
    expect(stats.photoCount).toBe(4)
    expect(stats.activeDays).toBe(2)
    expect(stats.firstPhotoDate).toBe('2026-06-01')
    expect(stats.lastPhotoDate).toBe('2026-06-02')
  })

  it('counts photos taken in the last 30 days', () => {
    const photos = [
      makePhoto('old', 'p1', '2026-05-15T08:00:00.000Z'),
      makePhoto('recent1', 'p1', '2026-06-20T08:00:00.000Z'),
      makePhoto('recent2', 'p1', '2026-06-30T08:00:00.000Z'),
    ]
    const stats = computeProjectStats('p1', photos, [], NOW)
    expect(stats.photosLast30Days).toBe(2)
  })

  it('breaks down defect statuses per project', () => {
    const defects = [
      makeDefect('d1', 'p1', 'open'),
      makeDefect('d2', 'p1', 'in_progress'),
      makeDefect('d3', 'p1', 'resolved'),
      makeDefect('d4', 'p1', 'closed'),
      makeDefect('d5', 'p2', 'open'),
    ]
    const stats = computeProjectStats('p1', [], defects, NOW)
    expect(stats.openDefects).toBe(1)
    expect(stats.inProgressDefects).toBe(1)
    expect(stats.resolvedDefects).toBe(2)
    expect(stats.healthScore).toBe(100 - 8 - 4)
    expect(stats.healthTier).toBe('healthy')
  })

  it('drops the tier once enough defects pile up', () => {
    const defects = [
      makeDefect('d1', 'p1', 'open'),
      makeDefect('d2', 'p1', 'open'),
      makeDefect('d3', 'p1', 'open'),
      makeDefect('d4', 'p1', 'open'),
      makeDefect('d5', 'p1', 'in_progress'),
    ]
    const stats = computeProjectStats('p1', [], defects, NOW)
    expect(stats.healthScore).toBe(100 - 32 - 4)
    expect(stats.healthTier).toBe('atRisk')
  })
})

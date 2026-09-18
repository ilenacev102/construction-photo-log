import { describe, expect, it } from 'vitest'
import { buildTimeline } from '@/lib/project-timeline'
import type { Photo, Defect, DailyLog } from '@/types/database'

function makePhoto(id: string, takenAt: string, note: string | null = null): Photo {
  return {
    id,
    project_id: 'p1',
    image_url: `/photos/${id}.jpg`,
    taken_at: takenAt,
    latitude: null,
    longitude: null,
    note,
    created_at: takenAt,
    trade_metadata: null,
  }
}

function makeDefect(id: string, createdAt: string, resolvedAt: string | null = null): Defect {
  return {
    id,
    project_id: 'p1',
    created_by: 'u1',
    assigned_to: null,
    title: `Defect ${id}`,
    description: '',
    severity: 'medium',
    status: resolvedAt ? 'resolved' : 'open',
    location: '',
    photo_ids: [],
    due_date: null,
    resolved_at: resolvedAt,
    resolution_notes: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function makeLog(id: string, date: string, description: string): DailyLog {
  return {
    id,
    project_id: 'p1',
    user_id: 'u1',
    log_date: date,
    weather: 'sunny',
    temperature: '25°C',
    work_description: description,
    notes: null,
    created_at: `${date}T08:00:00.000Z`,
    updated_at: `${date}T08:00:00.000Z`,
  }
}

describe('buildTimeline', () => {
  it('returns empty when there is no data', () => {
    expect(buildTimeline([], [], [])).toEqual([])
  })

  it('emits photo events using taken_at when present', () => {
    const days = buildTimeline(
      [makePhoto('ph1', '2026-07-05T10:00:00.000Z', 'Foundation')],
      [],
      [],
    )
    expect(days).toHaveLength(1)
    expect(days[0].events).toHaveLength(1)
    expect(days[0].events[0]).toMatchObject({
      kind: 'photo',
      title: 'Foundation',
      meta: '/photos/ph1.jpg',
    })
  })

  it('skips photos without a usable date', () => {
    const photo = makePhoto('ph1', '2026-07-05T10:00:00.000Z')
    photo.taken_at = null
    photo.created_at = null as unknown as string
    expect(buildTimeline([photo], [], [])).toEqual([])
  })

  it('emits both open and resolved events for resolved defects', () => {
    const days = buildTimeline(
      [],
      [makeDefect('d1', '2026-07-01T09:00:00.000Z', '2026-07-10T09:00:00.000Z')],
      [],
    )
    const kinds = days.flatMap((d) => d.events.map((e) => e.kind))
    expect(kinds).toContain('defect_open')
    expect(kinds).toContain('defect_resolved')
  })

  it('emits only the open event for unresolved defects', () => {
    const days = buildTimeline([], [makeDefect('d1', '2026-07-01T09:00:00.000Z')], [])
    expect(days.flatMap((d) => d.events).map((e) => e.kind)).toEqual(['defect_open'])
  })

  it('emits daily log events', () => {
    const days = buildTimeline([], [], [makeLog('l1', '2026-07-03', 'Concrete pour')])
    expect(days[0].events[0]).toMatchObject({
      kind: 'daily_log',
      title: 'Concrete pour',
      meta: 'sunny',
    })
  })

  it('sorts events newest first', () => {
    const days = buildTimeline(
      [makePhoto('ph1', '2026-07-01T10:00:00.000Z')],
      [makeDefect('d1', '2026-07-03T09:00:00.000Z')],
      [makeLog('l1', '2026-07-02', 'Work')],
    )
    expect(days.map((d) => d.date)).toEqual(['2026-07-03', '2026-07-02', '2026-07-01'])
  })

  it('groups events that share a day', () => {
    const days = buildTimeline(
      [makePhoto('ph1', '2026-07-02T10:00:00.000Z')],
      [makeDefect('d1', '2026-07-02T09:00:00.000Z')],
      [makeLog('l1', '2026-07-02', 'Work')],
    )
    expect(days).toHaveLength(1)
    expect(days[0].events).toHaveLength(3)
  })
})

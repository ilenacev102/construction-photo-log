import type { Photo, Defect, DailyLog } from '@/types/database'
import { DEFAULT_TZ, dayKeyInTz } from '@/lib/time'

export type TimelineEventKind = 'photo' | 'defect_open' | 'defect_resolved' | 'daily_log'

export interface TimelineEvent {
  id: string
  kind: TimelineEventKind
  date: string
  title: string
  description: string | null
  meta: string | null
}

export interface TimelineDay {
  date: string
  events: TimelineEvent[]
}

// Resolves the effective event timestamp for a photo, preferring the
// recorded capture time over the upload timestamp.
export function photoDate(photo: Photo, fallbackToCreatedAt = true): string | null {
  return photo.taken_at ?? (fallbackToCreatedAt ? photo.created_at : null) ?? null
}

/**
 * Canonical grouping of photos by calendar day key in the target timezone.
 * Resolves the date via `photoDate` and formats via `dayKeyInTz`.
 */
export function groupPhotosByDay(
  photos: Photo[],
  tz: string = DEFAULT_TZ,
  fallbackToCreatedAt = true,
): Map<string, Photo[]> {
  const buckets = new Map<string, Photo[]>()
  for (const photo of photos) {
    const date = photoDate(photo, fallbackToCreatedAt)
    if (!date) continue
    const key = dayKeyInTz(date, tz)
    const existing = buckets.get(key)
    if (existing) {
      existing.push(photo)
    } else {
      buckets.set(key, [photo])
    }
  }
  return buckets
}

export function buildTimeline(
  photos: Photo[],
  defects: Defect[],
  dailyLogs: DailyLog[],
  tz: string = DEFAULT_TZ,
): TimelineDay[] {
  const events: TimelineEvent[] = []

  for (const photo of photos) {
    const date = photoDate(photo)
    if (!date) continue
    events.push({
      id: `photo:${photo.id}`,
      kind: 'photo',
      date,
      title: photo.note ?? '',
      description: null,
      meta: photo.thumbnail_url ?? photo.image_url,
    })
  }

  for (const defect of defects) {
    events.push({
      id: `defect_open:${defect.id}`,
      kind: 'defect_open',
      date: defect.created_at,
      title: defect.title,
      description: null,
      meta: defect.severity,
    })
    if (defect.resolved_at) {
      events.push({
        id: `defect_resolved:${defect.id}`,
        kind: 'defect_resolved',
        date: defect.resolved_at,
        title: defect.title,
        description: null,
        meta: defect.severity,
      })
    }
  }

  for (const log of dailyLogs) {
    events.push({
      id: `daily_log:${log.id}`,
      kind: 'daily_log',
      date: log.log_date,
      title: log.work_description,
      description: log.notes ?? null,
      meta: log.weather ?? null,
    })
  }

  const sorted = events.sort((a, b) => b.date.localeCompare(a.date))

  const days: TimelineDay[] = []
  for (const event of sorted) {
    const dayKey = eventDayKey(event, tz)
    const last = days[days.length - 1]
    if (last && last.date === dayKey) {
      last.events.push(event)
    } else {
      days.push({ date: dayKey, events: [event] })
    }
  }

  return days
}

// Day-group key per event kind. Daily log dates are already canonical
// YYYY-MM-DD day keys (a `date` column); running them through dayKeyInTz
// would re-interpret them as UTC-midnight instants and shift a day in
// negative-offset timezones. Photos and defect events carry ISO instants
// and are bucketed in the project tz.
function eventDayKey(event: TimelineEvent, tz: string): string {
  if (event.kind === 'daily_log') {
    return event.date.slice(0, 10)
  }
  return dayKeyInTz(event.date, tz)
}
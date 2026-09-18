import { TZDate } from '@date-fns/tz'
import type { Photo } from '@/types/database'
import { DEFAULT_TZ, dayKeyInTz } from '@/lib/time'
import { groupPhotosByDay as canonicalGroupPhotosByDay } from '@/lib/project-timeline'

/** Canonical day key (YYYY-MM-DD) of an ISO timestamp in the project tz. */
export function toDayKey(iso: string, tz: string = DEFAULT_TZ): string {
  return dayKeyInTz(iso, tz)
}

/** Group photos by day key in the project tz. Photos without taken_at are skipped. */
export function groupPhotosByDay(
  photos: Photo[],
  tz: string = DEFAULT_TZ,
): Map<string, Photo[]> {
  return canonicalGroupPhotosByDay(photos, tz, false)
}

export interface CalendarCell {
  /** Day key (YYYY-MM-DD) in the project tz, or null for padding cells. */
  key: string | null
  /** Day date for display; null for padding cells. */
  date: Date | null
  /** Number of photos that day (0 when the key is missing from buckets). */
  count: number
}

/** One row (week) of the calendar; index 0 = Sunday (getDay() semantics). */
export type CalendarWeek = CalendarCell[]

/** Intensity level 0-4 used to pick the heatmap tile color. */
export function intensityForCount(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0
  const ratio = count / maxCount
  if (ratio >= 0.75) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

/**
 * Build a week grid covering [startDate, endDate] inclusive in the project tz.
 * Each week starts on Sunday; cells outside the range are padding (null).
 * Weeks are returned oldest first. Cell dates are TZDate instances so
 * date-fns `format` renders them in the project tz.
 */
export function buildCalendarGrid(
  startDate: Date,
  endDate: Date,
  tz: string = DEFAULT_TZ,
): CalendarWeek[] {
  // Anchor the grid on calendar days in the project tz.
  const startTz = new TZDate(startDate, tz)
  const start = new TZDate(
    startTz.getFullYear(),
    startTz.getMonth(),
    startTz.getDate(),
    0,
    0,
    0,
    0,
    tz,
  )
  const endTz = new TZDate(endDate, tz)
  const end = new TZDate(
    endTz.getFullYear(),
    endTz.getMonth(),
    endTz.getDate(),
    0,
    0,
    0,
    0,
    tz,
  )

  // Roll start back to the preceding Sunday so the first week is complete.
  const gridStart = new TZDate(start)
  gridStart.setDate(start.getDate() - start.getDay())

  const weeks: CalendarWeek[] = []
  const cursor = new TZDate(gridStart)

  while (cursor <= end) {
    const week: CalendarCell[] = []
    for (let dow = 0; dow < 7; dow += 1) {
      const cellDate = new TZDate(cursor)
      const inRange = cellDate >= start && cellDate <= end
      week.push(
        inRange
          ? { key: toDayKey(cellDate.toISOString(), tz), date: cellDate, count: 0 }
          : { key: null, date: null, count: 0 },
      )
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

/** Fill a grid's counts from photo buckets. Returns a fresh grid. */
export function applyCounts(
  grid: CalendarWeek[],
  buckets: Map<string, Photo[]>,
): CalendarWeek[] {
  return grid.map((week) =>
    week.map((cell) => {
      if (!cell.key) return cell
      const photos = buckets.get(cell.key)
      return photos ? { ...cell, count: photos.length } : cell
    }),
  )
}

/** Largest per-day photo count across a grid (0 when empty). */
export function maxDailyCount(grid: CalendarWeek[]): number {
  let max = 0
  for (const week of grid) {
    for (const cell of week) {
      if (cell.count > max) max = cell.count
    }
  }
  return max
}

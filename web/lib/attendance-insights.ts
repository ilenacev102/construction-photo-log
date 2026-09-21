import type { AttendanceLog } from '@/types/database'
import { DEFAULT_TZ, dayKeyInTz, todayStartInTz, addDays } from '@/lib/time'

export interface AttendanceDay {
  date: string
  minutes: number
}

export interface AttendanceInsights {
  totalMinutes: number
  totalDays: number
  avgMinutes: number | null
  longestMinutes: number | null
  dayBuckets: AttendanceDay[]
}

export const BUCKET_DAYS = 14

export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return '--'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function attendanceInsights(
  logs: AttendanceLog[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): AttendanceInsights {
  const minutesByDay = new Map<string, number>()

  for (const log of logs) {
    const minutes = log.duration_minutes
    if (minutes === null || minutes <= 0) continue

    // Bucket by check-in, falling back to created_at — never "now" (a missing timestamp is not today).
    const tsSource = log.check_in ?? log.created_at
    if (!tsSource) continue
    const ts = new Date(tsSource).getTime()
    if (Number.isNaN(ts)) continue

    const key = dayKeyInTz(new Date(ts).toISOString(), tz)
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + minutes)
  }

  const totalMinutes = [...minutesByDay.values()].reduce((a, b) => a + b, 0)
  const totalDays = minutesByDay.size

  const durations = logs
    .map((l) => l.duration_minutes)
    .filter((m): m is number => m !== null && m > 0)

  const avgMinutes = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null
  const longestMinutes = durations.length > 0 ? Math.max(...durations) : null

  // Bucket the last BUCKET_DAYS calendar days (including today) in the project
  // tz, zero-filled, oldest first. DST-safe via addDays on today's start.
  const dayBuckets: AttendanceDay[] = []
  const todayStart = todayStartInTz(tz, now)
  for (let i = 0; i < BUCKET_DAYS; i += 1) {
    const d = addDays(tz, todayStart, i - (BUCKET_DAYS - 1))
    const key = dayKeyInTz(d.toISOString(), tz)
    dayBuckets.push({ date: key, minutes: minutesByDay.get(key) ?? 0 })
  }

  return { totalMinutes, totalDays, avgMinutes, longestMinutes, dayBuckets }
}

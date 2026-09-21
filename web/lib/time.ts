import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import type { Project, Company } from '@/types/database'

/** Fallback IANA timezone when neither a project nor a company specifies one. */
export const DEFAULT_TZ = 'UTC'

const DAY_MS = 24 * 60 * 60 * 1000

/** Resolve the IANA tz for a project: project -> company -> DEFAULT_TZ. */
export function projectTz(
  project?: Pick<Project, 'timezone'> | null,
  company?: Pick<Company, 'timezone'> | null,
): string {
  if (project?.timezone) return project.timezone
  if (company?.timezone) return company.timezone
  return DEFAULT_TZ
}

/** Canonical day key (YYYY-MM-DD) of an ISO instant in the project tz. */
export function dayKeyInTz(iso: string, tz: string): string {
  return format(new TZDate(iso, tz), 'yyyy-MM-dd')
}

/** "Today" (start-of-day ISO instant) in the project tz. */
export function todayStartInTz(tz: string, now?: Date): Date {
  const d = new TZDate(now ?? new Date(), tz)
  const start = new TZDate(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
    0,
    0,
    0,
    tz,
  )
  return new Date(start.getTime())
}

/** Calendar-day arithmetic (DST-safe). Replaces all 24h DAY_MS math. */
export function addDays(tz: string, date: Date, days: number): Date {
  const d = new TZDate(date, tz)
  const result = new TZDate(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + days,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
    tz,
  )
  return new Date(result.getTime())
}

/** Whole calendar days between two instants in the given tz (DST-safe). */
export function diffCalendarDays(tz: string, a: Date, b: Date): number {
  const aKey = dayKeyInTz(a.toISOString(), tz)
  const bKey = dayKeyInTz(b.toISOString(), tz)
  const aMs = Date.parse(`${aKey}T00:00:00.000Z`)
  const bMs = Date.parse(`${bKey}T00:00:00.000Z`)
  return Math.round((bMs - aMs) / DAY_MS)
}
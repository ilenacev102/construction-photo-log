import type { Defect } from '@/types/database'
import { DEFAULT_TZ, diffCalendarDays } from '@/lib/time'

export type AgingTier = 'fresh' | 'warning' | 'overdue'

export interface AgedDefect {
  defect: Defect
  daysOpen: number
  tier: AgingTier
}

export interface AgingBreakdown {
  items: AgedDefect[]
  oldestDays: number | null
  avgDays: number | null
  counts: Record<AgingTier, number>
}

export function daysOpen(
  defect: Defect,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): number {
  if (!defect.created_at) return 0
  const created = new Date(defect.created_at)
  if (Number.isNaN(created.getTime())) return 0
  return Math.max(0, diffCalendarDays(tz, created, now))
}

export function agingTierFor(days: number): AgingTier {
  if (!Number.isFinite(days) || days < 7) return 'fresh'
  if (days < 14) return 'warning'
  return 'overdue'
}

export function agingBreakdown(
  defects: Defect[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): AgingBreakdown {
  const active = defects.filter(
    (d) => d.status === 'open' || d.status === 'in_progress',
  )

  const items: AgedDefect[] = active
    .map((defect) => {
      const days = daysOpen(defect, now, tz)
      return { defect, daysOpen: days, tier: agingTierFor(days) }
    })
    .sort((a, b) => b.daysOpen - a.daysOpen)

  const counts: Record<AgingTier, number> = { fresh: 0, warning: 0, overdue: 0 }
  for (const item of items) {
    counts[item.tier] += 1
  }

  const oldestDays = items.length > 0 ? items[0].daysOpen : null
  const avgDays =
    items.length > 0
      ? Math.round(
          items.reduce((sum, item) => sum + item.daysOpen, 0) / items.length,
        )
      : null

  return { items, oldestDays, avgDays, counts }
}
/**
 * Pure, UI-agnostic logic for the Organization Command Center.
 * No React, no fetch — fully unit-testable.
 *
 * The subscription/billing system was removed — every limit is unlimited.
 */

// ── Types ──

export type UsageKey = 'seats' | 'photos' | 'projects'

/** 0–100 as a whole percent; 0 when unlimited. */
export type UsageMeterTier = 'ok' | 'warning' | 'critical'

export interface UsageMeter {
  key: UsageKey
  used: number
  /** null = unlimited. */
  limit: number | null
  unlimited: boolean
  percent: number
  tier: UsageMeterTier
}

export type AttentionSeverity = 'info' | 'warning' | 'critical'

export type AttentionKind =
  | 'seats-near'
  | 'seats-reached'
  | 'photos-near'
  | 'photos-reached'
  | 'projects-near'
  | 'projects-reached'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: AttentionSeverity
  /** Resource usage (seats/photos/projects) — only for limit items. */
  used?: number
  /** Resource limit — only for limit items. */
  limit?: number | null
  /** Percent used — only for '*-near' items. */
  percent?: number
}

export interface AdminStats {
  totalUsers: number
  totalProjects: number
  totalPhotos: number
}

// ── Usage meters ──

/**
 * Build the three usage meters (seats / photos / projects).
 *
 * Billing was removed — everything is unlimited, so every meter is 'ok'.
 * Kept as pure data so the UI keeps a stable shape.
 */
export function computeUsageMeters(stats: AdminStats): UsageMeter[] {
  const build = (key: UsageKey, used: number): UsageMeter => ({
    key,
    used,
    limit: null,
    unlimited: true,
    percent: 0,
    tier: 'ok',
  })

  return [
    build('seats', stats.totalUsers),
    build('photos', stats.totalPhotos),
    build('projects', stats.totalProjects),
  ]
}

// ── Attention items ──

const SEVERITY_ORDER: Record<AttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/**
 * Derive attention items from the meters.
 *
 * With billing gone all meters are unlimited; the loop below only fires if a
 * finite `limit` ever reappears. Sorted critical → warning → info.
 */
export function buildAttentionItems(meters: UsageMeter[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const m of meters) {
    if (m.unlimited) continue
    if (m.tier === 'critical') {
      items.push({
        id: `${m.key}-reached`,
        kind: `${m.key}-reached`,
        severity: 'critical',
        used: m.used,
        limit: m.limit,
      })
    } else if (m.tier === 'warning') {
      items.push({
        id: `${m.key}-near`,
        kind: `${m.key}-near`,
        severity: 'warning',
        used: m.used,
        limit: m.limit,
        percent: m.percent,
      })
    }
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

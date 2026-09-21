export type HealthTier = 'healthy' | 'atRisk' | 'critical'

export const TIER_STYLES: Record<HealthTier, string> = {
  healthy: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400',
  atRisk: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function healthScoreFor(open: number, inProgress: number): number {
  if (open === Infinity || inProgress === Infinity) return 0
  const safeOpen = Math.max(0, Number.isFinite(open) ? open : 0)
  const safeInProgress = Math.max(0, Number.isFinite(inProgress) ? inProgress : 0)
  return Math.max(0, Math.min(100, Math.round(100 - safeOpen * 8 - safeInProgress * 4)))
}

export function healthTierFor(score: number): HealthTier {
  return score >= 75 ? 'healthy' : score >= 45 ? 'atRisk' : 'critical'
}

'use client'

import { useTranslations } from 'next-intl'
import { useDefects } from '@/hooks/useDefects'
import { computeRiskScore, type RiskScoreInput, type RiskTier } from '@/lib/risk-score'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Minimal client consumer of the explainable risk engine (Unit C).
 *
 * Fetches the project's defects via `useDefects`, builds a `RiskScoreInput`
 * and renders the resulting tier pill plus the `signals[]` list so the score
 * is explainable at a glance. Evidence inputs are optional props — when the
 * caller has photo/daily-log/attendance data it should pass them; otherwise
 * the window is assumed fully documented so this component never invents
 * staleness risk it has no data for.
 */
interface ProjectRiskScoreProps {
  projectId: string
  windowDays?: number
  evidenceDays?: number
  lastEvidenceDate?: string | null
  today?: Date
}

const DEFAULT_WINDOW_DAYS = 7

const RISK_TIER_STYLES: Record<RiskTier, string> = {
  low: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function ProjectRiskScore({
  projectId,
  windowDays = DEFAULT_WINDOW_DAYS,
  evidenceDays = windowDays,
  lastEvidenceDate = null,
  today,
}: ProjectRiskScoreProps) {
  const t = useTranslations('riskScore')
  const { defects, isLoading } = useDefects({ projectId })

  if (isLoading) {
    return <Skeleton className="h-7 w-32 rounded-full" />
  }

  const input: RiskScoreInput = {
    defects,
    workOrders: [],
    evidenceDays,
    windowDays,
    lastEvidenceDate,
    today: today ?? new Date(),
  }
  const result = computeRiskScore(input)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
            RISK_TIER_STYLES[result.tier],
          )}
          aria-label={t('scoreLabel', { score: result.score })}
        >
          <span className="font-semibold">{result.score}</span>
          <span>{result.tier}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {t('confidence', { confidence: result.confidence })}
        </span>
      </div>

      {result.signals.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {result.signals.map((signal, index) => (
            <li key={`${signal.reason}-${index}`}>
              <span className="text-foreground">{signal.reason}</span>
              <span className="ml-1">
                ({signal.value}/{signal.threshold})
              </span>
              <span className="ml-1 italic">{signal.action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

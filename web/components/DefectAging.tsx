'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { agingBreakdown, type AgingTier } from '@/lib/defect-aging'
import { DEFAULT_TZ } from '@/lib/time'
import type { Defect } from '@/types/database'

interface DefectAgingProps {
  defects: Defect[]
  tz?: string
}

const TIER_BADGE: Record<AgingTier, string> = {
  fresh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function DefectAging({ defects, tz = DEFAULT_TZ }: DefectAgingProps) {
  const t = useTranslations('defectAging')
  const breakdown = useMemo(() => agingBreakdown(defects, undefined, tz), [defects, tz])

  if (breakdown.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('noActive')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border bg-muted/40 py-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {breakdown.oldestDays}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t('days')}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{t('oldest')}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 py-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {breakdown.avgDays}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t('days')}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{t('avgAge')}</p>
          </div>
        </div>

        <ul className="space-y-2">
          {breakdown.items.map(({ defect, daysOpen, tier }) => (
            <li
              key={defect.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {defect.title}
                </p>
                {defect.location ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {defect.location}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_BADGE[tier]}`}
                >
                  {t(tier)}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {daysOpen} {t('days')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

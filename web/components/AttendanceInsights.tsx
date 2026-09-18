'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { attendanceInsights, formatDuration } from '@/lib/attendance-insights'
import { DEFAULT_TZ } from '@/lib/time'
import type { AttendanceLog } from '@/types/database'

interface AttendanceInsightsProps {
  logs: AttendanceLog[]
  tz?: string
}

export default function AttendanceInsights({ logs, tz = DEFAULT_TZ }: AttendanceInsightsProps) {
  const t = useTranslations('attendanceInsights')
  const locale = useLocale()
  const insights = useMemo(() => attendanceInsights(logs, undefined, tz), [logs, tz])

  const maxMinutes = useMemo(
    () => Math.max(...insights.dayBuckets.map((d) => d.minutes), 1),
    [insights.dayBuckets],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="min-w-0 rounded-lg border bg-muted/40 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatDuration(insights.totalMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">{t('totalTime')}</p>
          </div>
          <div className="min-w-0 rounded-lg border bg-muted/40 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {insights.totalDays}
            </p>
            <p className="text-xs text-muted-foreground">{t('workDays')}</p>
          </div>
          <div className="min-w-0 rounded-lg border bg-muted/40 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatDuration(insights.avgMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">{t('avgShift')}</p>
          </div>
          <div className="min-w-0 rounded-lg border bg-muted/40 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatDuration(insights.longestMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">{t('longestShift')}</p>
          </div>
        </div>

        {insights.totalDays > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t('last14Days')}
            </p>
            <div className="flex h-20 items-end gap-1">
              {insights.dayBuckets.map((day) => (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                  title={`${day.date}: ${formatDuration(day.minutes)}`}
                >
                  <div
                    className="w-full rounded-sm bg-primary/70 transition-colors group-hover:bg-primary"
                    style={{
                      height: `${Math.max((day.minutes / maxMinutes) * 100, day.minutes > 0 ? 8 : 2)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>
                {new Date(insights.dayBuckets[0].date).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span>
                {new Date(
                  insights.dayBuckets[insights.dayBuckets.length - 1].date,
                ).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

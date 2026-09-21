'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Cloud, CloudRain, CloudSun, Snowflake, Sun, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { climateSummary } from '@/lib/weather-summary'
import type { DailyLog } from '@/types/database'

interface ProjectClimateProps {
  dailyLogs: DailyLog[]
  logsLoading: boolean
  logsError: string | null
}

const MAX_STRIP_DAYS = 14

// Maps free-text weather values (typed in DailyLogForm) to a lucide icon.
// Unknown values fall back to a generic thermometer.
function weatherIcon(weather: string | null): LucideIcon {
  if (!weather) return Thermometer
  const w = weather.toLowerCase()
  if (w.includes('sunny') || w.includes('clear')) return Sun
  if (w.includes('partly') || w.includes('scattered')) return CloudSun
  if (w.includes('cloud') || w.includes('overcast')) return Cloud
  if (w.includes('rain') || w.includes('shower') || w.includes('drizzle')) return CloudRain
  if (w.includes('storm') || w.includes('thunder')) return CloudRain
  if (w.includes('snow')) return Snowflake
  if (w.includes('fog') || w.includes('mist')) return Cloud
  if (w.includes('wind')) return Cloud
  return Thermometer
}

export default function ProjectClimate({ dailyLogs, logsLoading }: ProjectClimateProps) {
  const t = useTranslations('projectClimate')
  const locale = useLocale()

  const summary = useMemo(() => climateSummary(dailyLogs), [dailyLogs])

  const stripDays = useMemo(() => summary.days.slice(-MAX_STRIP_DAYS).reverse(), [summary.days])

  if (logsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t('loading')}
        </CardContent>
      </Card>
    )
  }

  const hasWeatherData =
    summary.days.length > 0 &&
    (summary.avgTemp !== null ||
      summary.days.some((d) => d.weather !== null))

  if (!hasWeatherData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('noData')}
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
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border bg-muted/40 py-2">
            <p className="text-xl font-semibold text-foreground">
              {summary.avgTemp !== null ? `${summary.avgTemp}°` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{t('avgTemp')}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 py-2">
            <p className="text-xl font-semibold text-foreground">
              {summary.minTemp !== null ? `${summary.minTemp}°` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{t('minTemp')}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 py-2">
            <p className="text-xl font-semibold text-foreground">
              {summary.maxTemp !== null ? `${summary.maxTemp}°` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{t('maxTemp')}</p>
          </div>
        </div>

        <ul className="flex flex-wrap gap-2">
          {stripDays.map((day) => {
            const Icon = weatherIcon(day.weather)
            return (
              <li
                key={day.date}
                className="flex min-w-16 flex-col items-center rounded-lg border px-2 py-2"
                title={day.weather ?? undefined}
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="mt-1 text-sm tabular-nums text-foreground">
                  {day.temperature !== null ? `${day.temperature}°` : '—'}
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(day.date).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

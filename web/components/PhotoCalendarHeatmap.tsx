'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import { enUS, mk, de, sl, sr } from 'date-fns/locale'
import type { Photo } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  groupPhotosByDay,
  buildCalendarGrid,
  applyCounts,
  maxDailyCount,
  intensityForCount,
} from '@/lib/photo-calendar'
import { addDays, todayStartInTz, DEFAULT_TZ } from '@/lib/time'
import { PhotoLightbox } from '@/components/PhotoLightbox'

const DATE_LOCALES: Record<string, Locale> = { en: enUS, mk, de, sl, sr }

/** Rolling window shown by the heatmap (weeks). */
const WINDOW_WEEKS = 26

const TILE_COLORS = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-600 dark:bg-emerald-500',
  'bg-emerald-800 dark:bg-emerald-400',
]

/** Weekday labels for the left gutter; index 0 = Sunday. */
const GUTTER_DOWS = [1, 3, 5] // Mon, Wed, Fri

export function PhotoCalendarHeatmap({
  photos,
  tz = DEFAULT_TZ,
}: {
  photos: Photo[]
  tz?: string
}) {
  const t = useTranslations('photoCalendar')
  const locale = useLocale()
  const dateLocale = DATE_LOCALES[locale] ?? enUS

  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const { weeks, maxCount, hasDated, buckets } = useMemo(() => {
    const photoBuckets = groupPhotosByDay(photos, tz)
    const end = todayStartInTz(tz)
    const start = addDays(tz, end, -WINDOW_WEEKS * 7)
    const grid = applyCounts(buildCalendarGrid(start, end, tz), photoBuckets)
    return {
      weeks: grid,
      maxCount: maxDailyCount(grid),
      hasDated: photoBuckets.size > 0,
      buckets: photoBuckets,
    }
  }, [photos, tz])

  if (!hasDated) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    )
  }

  return (
    <section aria-label={t('title')}>
      <h2 className="text-lg font-semibold">{t('title')}</h2>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-block">
          {/* Month labels */}
          <div className="ml-8 flex gap-[3px]">
            {weeks.map((week, weekIndex) => {
              const first = week.find((cell) => cell.date)
              const label =
                first?.date && (weekIndex === 0 || week[0].date?.getMonth() !== weeks[weekIndex - 1][0].date?.getMonth())
                  ? format(first.date, 'MMM', { locale: dateLocale })
                  : ''
              return (
                <div
                  key={`month-${weekIndex}`}
                  className="w-3 shrink-0 text-[10px] leading-4 text-muted-foreground"
                >
                  {label}
                </div>
              )
            })}
          </div>

          {/* Grid */}
          <div className="mt-1 flex gap-[3px]">
            {/* Day gutter */}
            <div className="mr-1 flex w-6 flex-col gap-[3px] text-right text-[10px] leading-3 text-muted-foreground">
              {Array.from({ length: 7 }, (_, dow) => {
                const label = GUTTER_DOWS.includes(dow) ? format(new Date(2026, 0, dow + 4), 'EEE', { locale: dateLocale }) : ''
                return (
                  <span key={dow} className="h-3 leading-3">
                    {label}
                  </span>
                )
              })}
            </div>

            {/* Week columns */}
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="flex flex-col gap-[3px]">
                {week.map((cell, dow) => {
                  const disabled = !cell.key || cell.count === 0
                  const level = intensityForCount(cell.count, maxCount)
                  return (
                    <button
                      key={`${weekIndex}-${dow}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!cell.key) return
                        const dayPhotos = buckets.get(cell.key) ?? []
                        setLightboxPhotos(dayPhotos)
                        setLightboxIndex(0)
                      }}
                      title={
                        cell.date
                          ? t('dayTooltip', {
                              date: format(cell.date, 'd MMM yyyy', { locale: dateLocale }),
                              count: cell.count,
                            })
                          : undefined
                      }
                      aria-label={
                        cell.date
                          ? t('dayTooltip', {
                              date: format(cell.date, 'd MMM yyyy', { locale: dateLocale }),
                              count: cell.count,
                            })
                          : undefined
                      }
                      className={cn(
                        'size-3 shrink-0 rounded-[3px] transition-colors',
                        TILE_COLORS[level],
                        disabled
                          ? 'cursor-default'
                          : 'cursor-pointer hover:ring-1 hover:ring-ring',
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="ml-8 mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{t('less')}</span>
            {TILE_COLORS.map((color) => (
              <span key={color} className={cn('size-3 rounded-[3px]', color)} />
            ))}
            <span>{t('more')}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen gallery for the selected day */}
      {lightboxPhotos !== null && lightboxPhotos[lightboxIndex] && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  )
}

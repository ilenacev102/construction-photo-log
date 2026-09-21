'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { useDefects } from '@/hooks/useDefects'
import { buildTimeline, type TimelineEventKind } from '@/lib/project-timeline'
import { DEFAULT_TZ } from '@/lib/time'
import type { Photo, DailyLog } from '@/types/database'

interface ProjectTimelineProps {
  projectId: string
  photos: Photo[]
  dailyLogs: DailyLog[]
  logsLoading: boolean
  logsError: string | null
  tz?: string
}

const KIND_META: Record<TimelineEventKind, { dot: string; labelKey: string }> = {
  photo: { dot: 'bg-sky-500 dark:bg-sky-400', labelKey: 'kindPhoto' },
  defect_open: { dot: 'bg-red-500 dark:bg-red-400', labelKey: 'kindDefectOpen' },
  defect_resolved: { dot: 'bg-emerald-500 dark:bg-emerald-400', labelKey: 'kindDefectResolved' },
  daily_log: { dot: 'bg-amber-500 dark:bg-amber-400', labelKey: 'kindDailyLog' },
}

export default function ProjectTimeline({
  projectId,
  photos,
  dailyLogs,
  logsLoading,
  tz = DEFAULT_TZ,
}: ProjectTimelineProps) {
  const t = useTranslations('projectTimeline')
  const locale = useLocale()
  const { defects } = useDefects({ projectId })

  const days = useMemo(
    () => buildTimeline(photos, defects, dailyLogs, tz),
    [photos, defects, dailyLogs, tz],
  )

  if (logsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t('loading')}
        </CardContent>
      </Card>
    )
  }

  if (days.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <div key={day.date}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </h3>
          <ol className="relative space-y-4 border-l pl-5">
            {day.events.map((event) => {
              const meta = KIND_META[event.kind]
              return (
                <li key={event.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1.5 size-2.5 rounded-full ${meta.dot}`}
                  />
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(meta.labelKey)}
                    </p>
                    {event.kind === 'photo' && event.meta ? (
                      <div className="relative mt-2 aspect-video max-h-40 w-full overflow-hidden rounded-md">
                        <Image
                          src={event.meta}
                          alt={event.title || t('kindPhoto')}
                          fill
                          sizes="(max-width: 640px) 100vw, 640px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-foreground">{event.title}</p>
                    )}
                    {event.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

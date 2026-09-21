'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { addMonths, addWeeks, format, startOfMonth, startOfWeek } from 'date-fns'
import { enUS, de, mk, sl, srLatn } from 'date-fns/locale'
import type { Photo, DefectStatus } from '@/types/database'
import { useDefects } from '@/hooks/useDefects'
import { getPhotos } from '@/lib/supabase/queries'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import DefectAging from '@/components/DefectAging'
import { DEFAULT_TZ } from '@/lib/time'

interface ProjectAnalyticsProps {
  projectId: string
  photos?: Photo[]
  tz?: string
}

interface Bucket {
  key: number
  start: Date
  label: string
  count: number
}

// date-fns locales keyed by the app's next-intl locale codes.
const LOCALE_MAP = { en: enUS, de, mk, sl, sr: srLatn } as const

const STATUS_ORDER: DefectStatus[] = ['open', 'in_progress', 'resolved', 'closed', 'rejected']

// Status colors use CSS variables so they adapt to dark mode.
const STATUS_COLORS: Record<DefectStatus, string> = {
  open: 'var(--destructive)',
  in_progress: 'var(--chart-1)',
  resolved: 'var(--chart-2)',
  closed: 'var(--chart-3)',
  rejected: 'var(--muted)',
}

const STATUS_KEYS: Record<DefectStatus, string> = {
  open: 'statusOpen',
  in_progress: 'statusInProgress',
  resolved: 'statusResolved',
  closed: 'statusClosed',
  rejected: 'statusRejected',
}

const BAR_CHART_WIDTH = 320
const BAR_CHART_HEIGHT = 170
const BAR_CHART_TOP = 24
const BAR_CHART_BOTTOM = 150
const BAR_CHART_PAD_LEFT = 12
const BAR_CHART_PAD_RIGHT = 12

export default function ProjectAnalytics({
  projectId,
  photos: photosProp,
  tz = DEFAULT_TZ,
}: ProjectAnalyticsProps) {
  const t = useTranslations('projectAnalytics')
  const locale = useLocale()
  const { defects, isLoading } = useDefects({ projectId })

  const [fetchedPhotos, setFetchedPhotos] = useState<Photo[]>([])
  const [photoLoading, setPhotoLoading] = useState(!photosProp)
  const photos = photosProp ?? fetchedPhotos

  useEffect(() => {
    if (photosProp) return
    let ignore = false
    const run = async () => {
      try {
        const data = await getPhotos(projectId)
        if (!ignore) {
          setFetchedPhotos(data)
        }
      } catch {
        // Leave the list empty; the empty state covers the failure.
      } finally {
        if (!ignore) {
          setPhotoLoading(false)
        }
      }
    }
    void run()
    return () => {
      ignore = true
    }
  }, [projectId, photosProp])

  const dfLocale = useMemo(
    () => LOCALE_MAP[locale as keyof typeof LOCALE_MAP] ?? enUS,
    [locale],
  )

  // Resolve the photo capture date, preferring the recorded taken_at timestamp.
  const photoDates = useMemo(() => {
    const dates: Date[] = []
    for (const photo of photos) {
      const raw = photo.taken_at ?? photo.created_at
      if (!raw) continue
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        dates.push(d)
      }
    }
    return dates
  }, [photos])

  // Bucket photo activity: last 12 weeks (from the latest photo) for larger
  // sets, or by month when there are few photos.
  const buckets = useMemo<Bucket[]>(() => {
    if (photoDates.length === 0) return []
    const mode: 'week' | 'month' = photoDates.length < 12 ? 'month' : 'week'

    let starts: Date[]
    if (mode === 'week') {
      const end = startOfWeek(
        photoDates.reduce((a, b) => (a > b ? a : b)),
        { weekStartsOn: 1 },
      )
      starts = Array.from({ length: 12 }, (_, i) => addWeeks(end, i - 11))
    } else {
      const first = photoDates.reduce((a, b) => (a < b ? a : b))
      const end = startOfMonth(
        photoDates.reduce((a, b) => (a > b ? a : b)),
      )
      const start = startOfMonth(first)
      const monthCount =
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
      const bucketStart = monthCount > 12 ? addMonths(end, -11) : start
      starts = Array.from({ length: Math.min(monthCount, 12) }, (_, i) =>
        addMonths(bucketStart, i),
      )
    }

    return starts.map((start) => {
      const key = start.getTime()
      const count = photoDates.reduce((acc, d) => {
        const bucketOf =
          mode === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d)
        return bucketOf.getTime() === key ? acc + 1 : acc
      }, 0)
      return {
        key,
        start,
        label: format(start, mode === 'week' ? 'd MMM' : 'MMM yyyy', {
          locale: dfLocale,
        }),
        count,
      }
    })
  }, [photoDates, dfLocale])

  const statusCounts = useMemo<Record<DefectStatus, number>>(() => {
    const counts: Record<DefectStatus, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      rejected: 0,
    }
    for (const defect of defects) {
      counts[defect.status] += 1
    }
    return counts
  }, [defects])

  const totalDefects = useMemo(
    () => STATUS_ORDER.reduce((sum, status) => sum + statusCounts[status], 0),
    [statusCounts],
  )

  const openDefects = useMemo(
    () => statusCounts.open + statusCounts.in_progress,
    [statusCounts],
  )

  const resolutionRate = useMemo(() => {
    if (totalDefects === 0) return 0
    const resolved = statusCounts.resolved + statusCounts.closed
    return Math.round((resolved / totalDefects) * 100)
  }, [totalDefects, statusCounts])

  if (isLoading || photoLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t('loading')}
        </CardContent>
      </Card>
    )
  }

  if (defects.length === 0 && photoDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="mb-3 size-10 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"
          />
        </svg>
        <h3 className="text-sm font-semibold text-foreground">{t('emptyTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyDesc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('totalDefects')} value={String(totalDefects)} />
        <StatCard label={t('openDefects')} value={String(openDefects)} />
        <StatCard label={t('resolutionRate')} value={`${resolutionRate}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('defectStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {totalDefects === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('noDefects')}
              </p>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <DonutChart statusCounts={statusCounts} total={totalDefects} />
                <StatusLegend statusCounts={statusCounts} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('photoActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {buckets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('noPhotos')}
              </p>
            ) : (
              <BarChart buckets={buckets} />
            )}
          </CardContent>
        </Card>
      </div>

      <DefectAging defects={defects} tz={tz} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function DonutChart({
  statusCounts,
  total,
}: {
  statusCounts: Record<DefectStatus, number>
  total: number
}) {
  const t = useTranslations('projectAnalytics')
  const [hoveredStatus, setHoveredStatus] = useState<DefectStatus | null>(null)

  const radius = 40
  const circumference = 2 * Math.PI * radius

  const segments = useMemo(() => {
    const fractions = STATUS_ORDER.map((status) =>
      total === 0 ? 0 : statusCounts[status] / total,
    )
    return STATUS_ORDER.map((status, index) => {
      const cumulative = fractions
        .slice(0, index)
        .reduce((sum, value) => sum + value, 0)
      return {
        status,
        dash: fractions[index] * circumference,
        offset: -cumulative * circumference,
      }
    })
  }, [statusCounts, total, circumference])

  const summary = STATUS_ORDER.map(
    (status) => `${t(STATUS_KEYS[status])}: ${statusCounts[status]}`,
  ).join(', ')

  return (
    <div
      className="flex shrink-0 flex-col items-center"
      onMouseLeave={() => setHoveredStatus(null)}
    >
      <div className="relative size-40">
        <svg
          viewBox="0 0 100 100"
          className="size-full"
          role="img"
          aria-label={`${t('defectStatus')} — ${summary}`}
        >
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={14}
          />
          {segments.map(({ status, dash, offset }) => {
            const dimmed = hoveredStatus !== null && hoveredStatus !== status
            return (
              <circle
                key={status}
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke={STATUS_COLORS[status]}
                strokeWidth={14}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                transform="rotate(-90 50 50)"
                style={{ transition: 'opacity 150ms', opacity: dimmed ? 0.3 : 1 }}
              >
                <title>{`${t(STATUS_KEYS[status])}: ${statusCounts[status]}`}</title>
              </circle>
            )
          })}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-2xl font-semibold tabular-nums text-foreground">{total}</span>
        </div>
      </div>
      <StatusLegend
        statusCounts={statusCounts}
        hoveredStatus={hoveredStatus}
        onHover={setHoveredStatus}
      />
    </div>
  )
}

function StatusLegend({
  statusCounts,
  hoveredStatus,
  onHover,
}: {
  statusCounts: Record<DefectStatus, number>
  hoveredStatus?: DefectStatus | null
  onHover?: (status: DefectStatus | null) => void
}) {
  const t = useTranslations('projectAnalytics')

  return (
    <ul className="w-full min-w-0 space-y-1 sm:w-44">
      {STATUS_ORDER.map((status) => {
        const dimmed = hoveredStatus !== undefined && hoveredStatus !== null && hoveredStatus !== status
        return (
          <li key={status}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onMouseEnter={() => onHover?.(status)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(status)}
              onBlur={() => onHover?.(null)}
              aria-label={`${t(STATUS_KEYS[status])}: ${statusCounts[status]}`}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
                aria-hidden="true"
              />
              <span
                className="flex-1 truncate text-foreground"
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                {t(STATUS_KEYS[status])}
              </span>
              <span className="tabular-nums text-muted-foreground">{statusCounts[status]}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function BarChart({ buckets }: { buckets: Bucket[] }) {
  const t = useTranslations('projectAnalytics')
  const [hovered, setHovered] = useState<number | null>(null)

  const plotWidth = BAR_CHART_WIDTH - BAR_CHART_PAD_LEFT - BAR_CHART_PAD_RIGHT
  const plotHeight = BAR_CHART_BOTTOM - BAR_CHART_TOP
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const slotWidth = plotWidth / buckets.length
  const barWidth = Math.min(slotWidth * 0.6, 22)

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${BAR_CHART_WIDTH} ${BAR_CHART_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('photoActivity')}
      >
        {buckets.map((bucket, index) => {
          const barHeight = (bucket.count / maxCount) * plotHeight
          const x = BAR_CHART_PAD_LEFT + index * slotWidth + (slotWidth - barWidth) / 2
          const y = BAR_CHART_BOTTOM - barHeight
          const centerX = x + barWidth / 2
          const dimmed = hovered !== null && hovered !== index
          return (
            <g key={bucket.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={2}
                style={{
                  fill: 'var(--chart-1)',
                  transition: 'opacity 150ms',
                  opacity: dimmed ? 0.4 : 1,
                }}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>
                  {t('barTooltip', { label: bucket.label, count: bucket.count })}
                </title>
              </rect>
              <text
                x={centerX}
                y={BAR_CHART_BOTTOM + 12}
                fontSize={7}
                textAnchor="end"
                fill="currentColor"
                className="fill-muted-foreground text-muted-foreground"
                transform={`rotate(-35 ${centerX} ${BAR_CHART_BOTTOM + 12})`}
              >
                {bucket.label}
              </text>
            </g>
          )
        })}
      </svg>

      {hovered !== null && buckets[hovered] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 max-w-[80vw] break-words rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm"
          style={{
            left: `${((BAR_CHART_PAD_LEFT + hovered * slotWidth + slotWidth / 2) / BAR_CHART_WIDTH) * 100}%`,
            top: `${((BAR_CHART_BOTTOM - (buckets[hovered].count / maxCount) * plotHeight) / BAR_CHART_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-6px',
          }}
        >
          {t('barTooltip', {
            label: buckets[hovered].label,
            count: buckets[hovered].count,
          })}
        </div>
      )}
    </div>
  )
}

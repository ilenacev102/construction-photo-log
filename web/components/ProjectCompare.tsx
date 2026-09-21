'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Defect, Photo, Project } from '@/types/database'
import { computeProjectStats } from '@/lib/project-compare'
import { projectTz } from '@/lib/time'
import { TIER_STYLES } from '@/lib/health-tiers'
import { cn } from '@/lib/utils'

interface ProjectCompareProps {
  projects: Project[]
  photos: Photo[]
  defects: Defect[]
}

const SELECT_CLASS =
  'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ProjectCompare({ projects, photos, defects }: ProjectCompareProps) {
  const t = useTranslations('projectCompare')
  const th = useTranslations('projectHealth')

  const [leftId, setLeftId] = useState<string>(projects[0]?.id ?? '')
  const [rightId, setRightId] = useState<string>(projects[1]?.id ?? projects[0]?.id ?? '')

  if (projects.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">{t('title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  const left = projects.find((p) => p.id === leftId) ?? projects[0]
  const right = projects.find((p) => p.id === rightId) ?? projects[1]
  const sameProject = left.id === right.id

  const leftStats = computeProjectStats(left.id, photos, defects, undefined, projectTz(left))
  const rightStats = computeProjectStats(right.id, photos, defects, undefined, projectTz(right))

  const metricRows = [
    { key: 'photoCount', left: leftStats.photoCount, right: rightStats.photoCount },
    { key: 'activeDays', left: leftStats.activeDays, right: rightStats.activeDays },
    { key: 'openDefects', left: leftStats.openDefects, right: rightStats.openDefects },
    {
      key: 'inProgressDefects',
      left: leftStats.inProgressDefects,
      right: rightStats.inProgressDefects,
    },
    {
      key: 'resolvedDefects',
      left: leftStats.resolvedDefects,
      right: rightStats.resolvedDefects,
    },
    {
      key: 'photosLast30Days',
      left: leftStats.photosLast30Days,
      right: rightStats.photosLast30Days,
    },
  ]

  const dateRows = [
    { key: 'firstPhotoDate', left: leftStats.firstPhotoDate, right: rightStats.firstPhotoDate },
    { key: 'lastPhotoDate', left: leftStats.lastPhotoDate, right: rightStats.lastPhotoDate },
  ]

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
      <p className="text-sm text-muted-foreground">{t('desc')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {t('leftProject')}
          </label>
          <select
            className={SELECT_CLASS}
            value={left.id}
            onChange={(e) => setLeftId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {t('rightProject')}
          </label>
          <select
            className={SELECT_CLASS}
            value={right.id}
            onChange={(e) => setRightId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sameProject ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t('sameProject')}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
            <span className="truncate text-sm font-semibold">{left.name}</span>
            <span className="text-xs text-muted-foreground">{t('vs')}</span>
            <span className="truncate text-right text-sm font-semibold">{right.name}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex justify-start">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
                  TIER_STYLES[leftStats.healthTier],
                )}
              >
                <span className="font-semibold">{leftStats.healthScore}</span>
                <span>{th(leftStats.healthTier)}</span>
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{t('healthScore')}</span>
            <div className="flex justify-end">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
                  TIER_STYLES[rightStats.healthTier],
                )}
              >
                <span className="font-semibold">{rightStats.healthScore}</span>
                <span>{th(rightStats.healthTier)}</span>
              </span>
            </div>
          </div>

          {metricRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-sm"
            >
              <span className="text-left font-medium tabular-nums">{row.left}</span>
              <span className="text-xs text-muted-foreground">{t(row.key)}</span>
              <span className="text-right font-medium tabular-nums">{row.right}</span>
            </div>
          ))}

          {dateRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="text-left text-muted-foreground">{row.left ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{t(row.key)}</span>
              <span className="text-right text-muted-foreground">{row.right ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

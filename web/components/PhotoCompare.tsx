'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import type { Photo } from '@/types/database'
import { cn } from '@/lib/utils'

interface PhotoCompareProps {
  photos: Photo[]
  loading?: boolean
}

interface LocationGroup {
  id: string
  latitude: number
  longitude: number
  photos: Photo[]
  firstDate: string
  lastDate: string
}

// ~20m at the equator in decimal degrees; groups photos closer than this.
const GPS_GROUP_THRESHOLD = 0.0002
const SLIDER_STEP = 5

function getPhotoDate(photo: Photo): string {
  return photo.taken_at ?? photo.created_at
}

function formatDate(dateString: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

function groupPhotosByLocation(photos: Photo[]): LocationGroup[] {
  const groups: LocationGroup[] = []
  const visited = new Set<string>()

  for (const photo of photos) {
    if (photo.latitude == null || photo.longitude == null) continue
    if (visited.has(photo.id)) continue

    const groupPhotos: Photo[] = []
    for (const candidate of photos) {
      if (candidate.latitude == null || candidate.longitude == null) continue
      if (visited.has(candidate.id)) continue
      const latDelta = Math.abs(candidate.latitude - photo.latitude)
      const lngDelta = Math.abs(candidate.longitude - photo.longitude)
      if (latDelta <= GPS_GROUP_THRESHOLD && lngDelta <= GPS_GROUP_THRESHOLD) {
        groupPhotos.push(candidate)
        visited.add(candidate.id)
      }
    }

    groupPhotos.sort((a, b) =>
      getPhotoDate(a).localeCompare(getPhotoDate(b)),
    )

    const first = groupPhotos[0]
    const last = groupPhotos[groupPhotos.length - 1]
    if (!first) continue

    groups.push({
      id: photo.id,
      latitude: photo.latitude,
      longitude: photo.longitude,
      photos: groupPhotos,
      firstDate: getPhotoDate(first),
      lastDate: getPhotoDate(last),
    })
  }

  // Earliest group first
  groups.sort((a, b) => a.firstDate.localeCompare(b.firstDate))

  return groups
}

export default function PhotoCompare({
  photos,
  loading = false,
}: PhotoCompareProps) {
  const t = useTranslations('photoCompare')
  const locale = useLocale()

  const groups = useMemo(() => groupPhotosByLocation(photos), [photos])

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null

  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)
  const [position, setPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  // Render-time state adjustment (React's documented pattern) — resets the
  // comparison when the selected location changes, avoiding an effect.
  const [prevGroupId, setPrevGroupId] = useState<string | null>(
    selectedGroup?.id ?? null,
  )
  const currentGroupId = selectedGroup?.id ?? null
  if (currentGroupId !== prevGroupId) {
    setPrevGroupId(currentGroupId)
    if (selectedGroup) {
      setBeforeId(selectedGroup.photos[0]?.id ?? null)
      setAfterId(selectedGroup.photos[selectedGroup.photos.length - 1]?.id ?? null)
      setPosition(50)
    }
  }

  const beforePhoto =
    selectedGroup?.photos.find((photo) => photo.id === beforeId) ??
    selectedGroup?.photos[0] ??
    null
  const afterPhoto =
    selectedGroup?.photos.find((photo) => photo.id === afterId) ??
    selectedGroup?.photos[selectedGroup.photos.length - 1] ??
    null

  const canCompare =
    beforePhoto != null && afterPhoto != null && beforePhoto.id !== afterPhoto.id

  const getPositionFromEvent = (
    event: React.PointerEvent<HTMLDivElement>,
  ): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return 50
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
    return (x / rect.width) * 100
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPosition(getPositionFromEvent(event))
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setPosition(getPositionFromEvent(event))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    // pointercancel auto-releases capture; releasePointerCapture on an
    // inactive pointer throws NotFoundError, so guard before releasing.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = position
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = position - SLIDER_STEP
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = position + SLIDER_STEP
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = 100
    } else {
      return
    }
    event.preventDefault()
    setPosition(Math.min(Math.max(next, 0), 100))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          role="status"
          aria-label={t('loading')}
          className="size-8 animate-spin rounded-full border-4 border-border border-t-foreground"
        />
      </div>
    )
  }

  if (groups.length === 0) {
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
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>

      {/* Location group selector */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const isActive = group.id === selectedGroup?.id
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              aria-pressed={isActive}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <p className="text-xs font-medium text-foreground">
                {t('coords', {
                  lat: group.latitude.toFixed(6),
                  lng: group.longitude.toFixed(6),
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('photosCount', { count: group.photos.length })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('range', {
                  from: formatDate(group.firstDate, locale),
                  to: formatDate(group.lastDate, locale),
                })}
              </p>
            </button>
          )
        })}
      </div>

      {/* Comparison area */}
      {selectedGroup != null && beforePhoto != null && canCompare && (
        <div className="space-y-3">
          <div
            role="slider"
            aria-label={t('sliderLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${Math.round(position)}%`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative aspect-[4/3] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl border border-border bg-muted shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* Before photo (base layer) */}
            <Image
              src={beforePhoto.image_url}
              alt={beforePhoto.note ?? t('before')}
              draggable={false}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="absolute inset-0 h-full w-full object-cover"
              priority
            />

            {/* After photo (clipped layer) */}
            <Image
              src={afterPhoto.image_url}
              alt={afterPhoto.note ?? t('after')}
              draggable={false}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
              priority
            />

            {/* Divider line */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent"
              style={{ left: `${position}%` }}
            />

            {/* Drag handle */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill border-2 border-accent bg-surface-raised text-accent shadow-elevation-2 backdrop-blur-md transition-transform duration-100 ease-apple-spring"
              style={{ left: `${position}%` }}
            >
              <svg
                className="size-5 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 9L5.25 12l3 3M15.75 9l3 3-3 3"
                />
              </svg>
            </div>

            {/* Label chips */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs"
            >
              {t('before')}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs"
            >
              {t('after')}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('range', {
              from: formatDate(getPhotoDate(beforePhoto), locale),
              to: formatDate(getPhotoDate(afterPhoto), locale),
            })}
          </p>

          {/* Photo pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t('before')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedGroup.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setBeforeId(photo.id)}
                    aria-label={t('selectBefore')}
                    aria-pressed={photo.id === beforePhoto.id}
                    className={cn(
                      'relative size-12 overflow-hidden rounded-md border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      photo.id === beforePhoto.id
                        ? 'border-primary'
                        : 'border-transparent opacity-70 hover:opacity-100',
                    )}
                  >
                    <Image
                      src={photo.image_url}
                      alt=""
                      draggable={false}
                      fill
                      sizes="48px"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t('after')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedGroup.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setAfterId(photo.id)}
                    aria-label={t('selectAfter')}
                    aria-pressed={photo.id === afterPhoto.id}
                    className={cn(
                      'relative size-12 overflow-hidden rounded-md border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      photo.id === afterPhoto.id
                        ? 'border-primary'
                        : 'border-transparent opacity-70 hover:opacity-100',
                    )}
                  >
                    <Image
                      src={photo.image_url}
                      alt=""
                      draggable={false}
                      fill
                      sizes="48px"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single-photo location fallback */}
      {selectedGroup != null && beforePhoto != null && !canCompare && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={beforePhoto.image_url}
              alt={beforePhoto.note ?? t('before')}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-muted-foreground">
            <span>{formatDate(getPhotoDate(beforePhoto), locale)}</span>
            <span>{t('singlePhoto')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { Photo } from '@/types/database'

interface TimelapseSlideshowProps {
  photos: Photo[]
  autoPlay?: boolean
  intervalMs?: number
}

export function TimelapseSlideshow({
  photos,
  autoPlay = true,
  intervalMs = 2000,
}: TimelapseSlideshowProps) {
  const t = useTranslations('timelapse')

  // Chronological progress order (oldest first); photos without a taken_at
  // timestamp keep their array order via the empty-string fallback.
  const sortedPhotos = useMemo(
    () =>
      [...photos].sort((a, b) =>
        (a.taken_at ?? '').localeCompare(b.taken_at ?? ''),
      ),
    [photos],
  )

  const total = sortedPhotos.length

  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [index, setIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  // Effective index stays in range even if the collection shrinks.
  const displayIndex = total === 0 ? 0 : index % total

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Autoplay advances every intervalMs; the interval is torn down when
  // paused, hidden, reduced-motion is preferred, or the collection/interval
  // changes.
  useEffect(() => {
    if (!isPlaying || total === 0 || prefersReducedMotion) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % total)
    }, intervalMs)
    return () => clearInterval(id)
  }, [isPlaying, total, intervalMs, prefersReducedMotion])

  // Pause autoplay while the tab is hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPlaying(false)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  if (total === 0) {
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

  const goPrev = () => {
    setIsPlaying(false)
    setIndex((prev) => (prev - 1 + total) % total)
  }

  const goNext = () => {
    setIsPlaying(false)
    setIndex((prev) => (prev + 1) % total)
  }

  const togglePlay = () => setIsPlaying((playing) => !playing)

  const progress = ((displayIndex + 1) / total) * 100

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted shadow-xs">
      {/* Single active frame — remounts on index change so only one <img>
          is ever in the DOM instead of the full stacked photo set. */}
      <Image
        key={displayIndex}
        src={sortedPhotos[displayIndex].image_url}
        alt={sortedPhotos[displayIndex].note ?? ''}
        draggable={false}
        fill
        priority={displayIndex === 0}
        sizes="(max-width: 768px) 100vw, 768px"
        className="animate-fade-in object-cover"
      />

      {/* Bottom scrim for legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Progress bar (current position in the timelapse) */}
      <div className="absolute inset-x-0 top-0 h-1 bg-white/20">
        <div
          className="h-full bg-white/90 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Position counter */}
      <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
        {t('photoCount', { current: displayIndex + 1, total })}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label={t('previous')}
          className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? t('pause') : t('play')}
          className="flex size-10 items-center justify-center rounded-full bg-white/90 text-black transition-colors hover:bg-white"
        >
          {isPlaying ? (
            <svg
              className="size-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg
              className="size-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={goNext}
          aria-label={t('next')}
          className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

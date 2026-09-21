'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import type { Photo } from '@/types/database'
import PhotoCard from '@/components/PhotoCard'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { groupPhotosByDay } from '@/lib/project-timeline'
import { DEFAULT_TZ } from '@/lib/time'

interface PhotoTimelineProps {
  photos: Photo[]
  onDeletePhoto?: (id: string) => void
  tz?: string
}

function formatGroupDate(dateKey: string, locale: string): string {
  const date = new Date(dateKey + 'T00:00:00')
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function PhotoTimeline({
  photos,
  onDeletePhoto,
  tz = DEFAULT_TZ,
}: PhotoTimelineProps) {
  const t = useTranslations('photoTimeline')
  const locale = useLocale()

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const sortedEntries = useMemo(() => {
    const groups = groupPhotosByDay(photos, tz, true)
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [photos, tz])

  if (photos.length === 0) {
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
        <p className="text-sm text-muted-foreground">
          {t('noPhotos')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-10">
        {sortedEntries.map(([dateKey, groupPhotos]) => (
          <div key={dateKey}>
            {/* Timeline dot + date header */}
            <div className="relative mb-4 flex items-center gap-3">
              <span className="relative flex size-3 shrink-0 items-center justify-center">
                <span className="inline-block size-3 rounded-full border-2 border-primary bg-background" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">
                {formatGroupDate(dateKey, locale)}
              </h3>
              {/* Connecting line (runs down from the dot) */}
              <span className="absolute left-[5px] top-3 h-[calc(100%+1.5rem)] w-0.5 -translate-x-1/2 bg-border" />
            </div>

            {/* Photo grid */}
            <div className="ml-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groupPhotos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onDelete={onDeletePhoto}
                  onClick={(p) => {
                    const idx = photos.findIndex((ph) => ph.id === p.id)
                    if (idx !== -1) {
                      setLightboxIndex(idx)
                      setLightboxOpen(true)
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
          onDelete={onDeletePhoto}
        />
      )}
    </>
  )
}

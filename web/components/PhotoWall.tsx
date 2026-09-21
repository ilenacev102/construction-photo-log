'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { enUS, mk, de, sl, sr } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import type { Photo, Project } from '@/types/database'

const DATE_LOCALES: Record<string, Locale> = { en: enUS, mk, de, sl, sr }
const ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/3]', 'aspect-[4/5]'] as const

interface PhotoWallProps {
  photos: Photo[]
  projects: Project[]
  limit?: number
}

export function PhotoWall({ photos, projects, limit = 18 }: PhotoWallProps) {
  const t = useTranslations('photoWall')
  const locale = useLocale()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const projectNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  const sorted = useMemo(
    () =>
      [...photos]
        .filter((p) => p.image_url && (p.taken_at ?? p.created_at))
        .sort((a, b) =>
          (b.taken_at ?? b.created_at).localeCompare(a.taken_at ?? a.created_at),
        )
        .slice(0, limit),
    [photos, limit],
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">{t('title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {sorted.map((photo, i) => {
          const projectName = projectNames.get(photo.project_id)
          const dateLabel = photo.taken_at
            ? format(new Date(photo.taken_at), 'PP', {
                locale: DATE_LOCALES[locale] ?? enUS,
              })
            : null

          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className={`min-w-0 group relative overflow-hidden rounded-lg border border-border bg-card ${ASPECTS[i % ASPECTS.length]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              <Image
                src={photo.thumbnail_url || photo.image_url}
                alt={projectName ?? t('photoAlt')}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="truncate text-xs font-medium text-white">
                  {projectName}
                </p>
                {dateLabel && (
                  <p className="text-[11px] text-white/75">{dateLabel}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <PhotoLightbox
        photos={sorted}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  )
}

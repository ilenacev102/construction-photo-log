'use client'

import { format } from 'date-fns'
import Image from 'next/image'
import type { Locale } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { enUS } from 'date-fns/locale/en-US'
import { mk } from 'date-fns/locale/mk'
import { sl } from 'date-fns/locale/sl'
import { srLatn } from 'date-fns/locale/sr-Latn'
import { useLocale, useTranslations } from 'next-intl'
import type { Photo } from '@/types/database'
import { Button } from '@/components/ui/button'

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
  mk,
  de,
  sl,
  sr: srLatn,
}

interface PhotoCardProps {
  photo: Photo
  onDelete?: (id: string) => void
  onClick?: (photo: Photo) => void
}

export default function PhotoCard({ photo, onDelete, onClick }: PhotoCardProps) {
  const t = useTranslations('photoCard')
  const locale = useLocale()
  const dateFnsLocale = DATE_FNS_LOCALES[locale]
  const dateLabel = photo.taken_at
    ? format(new Date(photo.taken_at), 'dd MMM yyyy', { locale: dateFnsLocale })
    : format(new Date(photo.created_at), 'dd MMM yyyy', { locale: dateFnsLocale })

  const gpsLabel =
    photo.latitude != null && photo.longitude != null
      ? t('gps', { lat: photo.latitude.toFixed(6), lng: photo.longitude.toFixed(6) })
      : null

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-surface-raised shadow-elevation-1 transition-all duration-200 ease-apple-spring hover:border-accent hover:shadow-elevation-2">
      {/* Thumbnail */}
      <button
        onClick={() => onClick?.(photo)}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent cursor-pointer"
      >
        <Image
          src={photo.thumbnail_url || photo.image_url}
          alt={photo.note ?? t('fallbackAlt')}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-300 ease-apple-spring group-hover:scale-105"
        />
        {gpsLabel && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-xs bg-background/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent backdrop-blur-sm shadow-xs">
            {gpsLabel}
          </div>
        )}
      </button>

      {/* Info section */}
      <div className="space-y-1.5 p-3">
        {/* Date */}
        <p className="font-mono text-[11px] font-semibold text-tertiary-foreground tabular-nums">{dateLabel}</p>

        {/* Note */}
        {photo.note && (
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{photo.note}</p>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <div className="absolute right-2 top-2 opacity-100 sm:opacity-0 transition-opacity duration-180 ease-apple-spring sm:group-hover:opacity-100">
          <Button
            variant="destructive"
            size="xs"
            onClick={() => onDelete(photo.id)}
            aria-label={t('deleteLabel')}
          >
            <svg
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {t('delete')}
          </Button>
        </div>
      )}
    </div>
  )
}

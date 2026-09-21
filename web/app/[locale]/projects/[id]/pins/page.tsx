'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import DrawingCanvas from '@/components/DrawingCanvas'
import BackButton from '@/components/BackButton'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import type { Photo } from '@/types/database'

interface PhotoWithPins extends Photo {
  pin_count: number
}

export default function PinsPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('pins')

  const [photos, setPhotos] = useState<PhotoWithPins[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithPins | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('photos')
      .select('*, drawing_pins(count)')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else if (data) {
          const withPins = data
            .filter((p) => {
              const pins = p.drawing_pins as { count: number }[] | undefined
              return pins && pins.length > 0 && pins[0].count > 0
            })
            .map((p) => {
              const pins = p.drawing_pins as { count: number }[] | undefined
              return {
                ...p,
                pin_count: pins?.[0]?.count ?? 0,
              } as PhotoWithPins
            })
          setPhotos(withPins)
        }
        setLoading(false)
      })
  }, [id])

  const handleBack = useCallback(() => {
    setSelectedPhoto(null)
  }, [])

  if (loading) {
    return <LoadingBlock />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <div className="mt-4">
          <BackButton href={`/projects/${id}`} label={t('back')} />
        </div>
      </div>
    )
  }

  if (selectedPhoto) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            className="size-4"
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
          {t('backToGallery')}
        </button>

        <div className="mt-6">
          <DrawingCanvas
            photoId={selectedPhoto.id}
            imageUrl={selectedPhoto.image_url}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={`${t('subtitle')} · ${t('total', { count: photos.length })}`}
        className="mt-6"
      />

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={MapPin}
            title={t('empty')}
            action={
              <Link
                href={`/projects/${id}/photos`}
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t('addPins')}
              </Link>
            }
          />
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative block w-full overflow-hidden rounded-md border border-border bg-surface-raised text-left shadow-elevation-1 transition-all duration-200 ease-apple-spring hover:-translate-y-0.5 hover:border-accent hover:shadow-elevation-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <Image
                  src={photo.image_url}
                  alt={photo.note ?? ''}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Pin count badge */}
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-sm">
                <MapPin className="size-3.5" />
                {photo.pin_count}
              </div>

              {/* Bottom note overlay */}
              {photo.note && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="line-clamp-1 text-xs text-white">
                    {photo.note}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { monitoring } from '@/lib/monitoring'
import { deletePhoto } from '@/lib/supabase/queries'
import type { Photo } from '@/types/database'
import BackButton from '@/components/BackButton'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useLabels } from '@/hooks/useLabels'
import { LabelFilterBar } from '@/components/labels/LabelFilterBar'
import PhotoCompare from '@/components/PhotoCompare'
import PhotoTimeline from '@/components/PhotoTimeline'
import { TimelapseSlideshow } from '@/components/TimelapseSlideshow'
import { PhotoCalendarHeatmap } from '@/components/PhotoCalendarHeatmap'

export default function PhotosPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('photosPage')

  const { groups } = useLabels()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [labelFilters, setLabelFilters] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const activeSlugs = [...new Set(Object.values(labelFilters).flat())].join(',')

    const url = `/api/photos?projectId=${encodeURIComponent(id)}${activeSlugs ? `&labelSlugs=${encodeURIComponent(activeSlugs)}` : ''}`

    fetch(url, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setPhotos(json.data as Photo[])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, labelFilters])

  const handleDelete = useCallback(
    async (photoId: string) => {
      try {
        await deletePhoto(photoId)
        setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      } catch (err) {
        monitoring.captureException(err, { extra: { component: 'photosPage', action: 'deletePhoto', projectId: id } })
      }
    },
    [id],
  )

  if (loading) {
    return <LoadingBlock />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <Link
          href={`/projects/${id}`}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      {/* Title + action */}
      <PageHeader
        title={t('title')}
        subtitle={t('total', { count: photos.length })}
        className="mt-6"
        actions={
          <Link
            href={`/projects/${id}/upload`}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            <Plus />
            {t('add')}
          </Link>
        }
      />

      {/* Label filters */}
      <div className="mb-6">
        <LabelFilterBar
          groups={groups}
          activeFilters={labelFilters}
          onChange={(groupId, slugs) => setLabelFilters((prev) => ({ ...prev, [groupId]: slugs }))}
        />
      </div>

      {/* Before/after comparison */}
      {photos.length > 0 && (
        <PhotoCompare photos={photos} />
      )}

      {/* Timelapse slideshow */}
      {photos.length > 1 && (
        <div className="mt-8">
          <TimelapseSlideshow photos={photos} />
        </div>
      )}

      {/* Photo activity calendar */}
      <div className="mt-8">
        <PhotoCalendarHeatmap photos={photos} />
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <PhotoTimeline photos={photos} onDeletePhoto={handleDelete} />
      </div>
    </div>
  )
}

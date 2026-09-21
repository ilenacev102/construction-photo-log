'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ProjectHealthScore } from '@/components/ProjectHealthScore'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import DailyLogForm from '@/components/DailyLogForm'
import DailyLogTimeline from '@/components/DailyLogTimeline'
import ProjectClimate from '@/components/ProjectClimate'
import ProjectTimeline from '@/components/ProjectTimeline'
import { useDailyLogs } from '@/hooks/useDailyLogs'
import { getProject, getPhotos } from '@/lib/supabase/queries'
import { downloadProjectCsv, EXPORT_TYPES, type ExportType } from '@/lib/export'
import { projectTz } from '@/lib/time'
import type { Project, Photo } from '@/types/database'
import { buttonVariants } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { FileQuestion, ImageIcon } from 'lucide-react'

// Heavy client-only chunks: leaflet and the analytics charting bundle are
// code-split and rendered only when their view is actually opened, keeping
// them out of the initial project-page bundle.
const PhotoMap = dynamic(() => import('@/components/PhotoMap'), { ssr: false })
const ProjectAnalytics = dynamic(
  () => import('@/components/ProjectAnalytics'),
  { ssr: false },
)

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('projectDetail')

  const [project, setProject] = useState<Project | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'photos' | 'map' | 'daily' | 'timeline'>('photos')
  const [error, setError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { logs: dailyLogs, loading: logsLoading, error: logsError, refetch: refetchLogs } = useDailyLogs(id)

  const labelMap: Record<ExportType, string> = {
    defects: t('exportDefects'),
    photos: t('exportPhotos'),
    logs: t('exportLogs'),
    work_orders: t('exportWorkOrders'),
    attendance: t('exportAttendance'),
  }

  useEffect(() => {
    Promise.all([getProject(id), getPhotos(id)])
      .then(([projectData, photosData]) => {
        setProject(projectData)
        setPhotos(photosData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <LoadingBlock />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('back')}
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          icon={FileQuestion}
          title={t('notFound')}
          action={
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('back')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="-m-1.5 inline-flex items-center gap-1 rounded-md p-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
        {t('back')}
      </Link>

      {/* Project details — the h1 name lives in [id]/layout.tsx */}
      <div className="mt-6">

        <div className="mt-4 space-y-1.5">
          {project.address && (
            <p className="text-sm text-muted-foreground">
              {t('address', { address: project.address })}
            </p>
          )}
          {project.client_name && (
            <p className="text-sm text-muted-foreground">
              {t('client', { name: project.client_name })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('created', { date: formatDate(project.created_at) })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('photos', { count: photos.length })}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/projects/${id}/upload`}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            {t('addPhoto')}
          </Link>
          {photos.length > 0 && (
            <Link
              href={`/projects/${id}/report`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('generateReport')}
            </Link>
          )}
          <details className="group relative">
            <summary
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
              )}
            >
              {t('exportCsv')}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
              {EXPORT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => downloadProjectCsv(id, type)}
                  className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {labelMap[type]}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* Analytics */}
      <div className="mt-10 space-y-4">
        <ProjectHealthScore projectId={id} />
        <ProjectAnalytics projectId={id} photos={photos} tz={projectTz(project)} />
      </div>

      {/* Photos section */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('photos', { count: photos.length })}</h2>
          {photos.length > 0 && view === 'photos' && (
            <Link
              href={`/projects/${id}/photos`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('allPhotos')}
            </Link>
          )}
        </div>

        {/* View toggle */}
        {photos.length > 0 && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setView('photos')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'photos'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('sitePhotos')} ({photos.length})
            </button>
            <button
              onClick={() => setView('map')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'map'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('mapView')} ({photos.filter((p) => p.latitude).length})
            </button>
            <button
              onClick={() => setView('daily')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'daily'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('journalView')}
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'timeline'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('timeline')}
            </button>
          </div>
        )}

        {view === 'photos' && photos.length === 0 && (
          <EmptyState
            icon={ImageIcon}
            title={t('noPhotos')}
            action={
              <Link
                href={`/projects/${id}/upload`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                {t('addFirst')}
              </Link>
            }
          />
        )}

        {view === 'photos' && photos.length > 0 && (
          <div className="mt-4">
            {/* Latest photo preview — opens fullscreen gallery */}
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              className="group relative block w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-xs transition-all hover:shadow-md"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted sm:aspect-[21/9]">
                <Image
                  src={photos[0].image_url}
                  alt={photos[0].note ?? 'Фотографија'}
                  fill
                  sizes="(max-width: 640px) 100vw, 80vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-sm font-medium text-white">
                  {t('photoCount', { count: photos.length })}
                </p>
                {photos[0].taken_at && (
                  <p className="text-xs text-white/80">
                    {formatDate(photos[0].taken_at)}
                  </p>
                )}
              </div>
            </button>
          </div>
        )}

        {view === 'map' && (
          <div className="mt-4">
            <PhotoMap photos={photos} />
          </div>
        )}

        {view === 'daily' && (
          <div className="mt-4 space-y-6">
            <DailyLogForm projectId={id} onCreated={() => refetchLogs()} />
            <ProjectClimate dailyLogs={dailyLogs} logsLoading={logsLoading} logsError={logsError} />
            <DailyLogTimeline dailyLogs={dailyLogs} logsLoading={logsLoading} logsError={logsError} refetchLogs={refetchLogs} />
          </div>
        )}

        {view === 'timeline' && (
          <div className="mt-4">
            <ProjectTimeline projectId={id} photos={photos} dailyLogs={dailyLogs} logsLoading={logsLoading} logsError={logsError} tz={projectTz(project)} />
          </div>
        )}
      </div>

      {/* Fullscreen gallery */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}

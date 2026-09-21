'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { getProject, getPhotos } from '@/lib/supabase/queries'
import type { Project, Photo } from '@/types/database'
import ReportBuilder from '@/components/ReportBuilder'
import BackButton from '@/components/BackButton'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileQuestion } from 'lucide-react'

export default function ReportPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('report')
  const pd = useTranslations('projectDetail')

  const [project, setProject] = useState<Project | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

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
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <div className="mt-4">
          <BackButton href={`/projects/${id}`} label={t('back')} />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          icon={FileQuestion}
          title={pd('notFound')}
          action={
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('backToList')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      {/* Page header */}
      <PageHeader title={t('title')} subtitle={project.name} className="mt-6" />

      {/* PDF generated successfully */}
      {pdfUrl ? (
        <div className="mt-8">
          <div className="rounded-md border border-border bg-surface-raised px-6 py-10 text-center shadow-elevation-1">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-muted/40">
              <svg
                className="size-8 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'default' }))}
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {t('downloadPDF')}
              </a>
              <Link
                href={`/projects/${id}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('back')}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Report builder */
        <div className="mt-8">
          <ReportBuilder
            projectId={id}
            photos={photos}
            onComplete={setPdfUrl}
          />
        </div>
      )}
    </div>
  )
}

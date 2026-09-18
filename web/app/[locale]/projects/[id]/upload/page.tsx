'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import BackButton from '@/components/BackButton'

export default function UploadPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('photoUpload')
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="size-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold">
            {t('successTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('successDesc', { count: 1 })}
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={() => setSuccess(false)}>
              {t('addMore')}
            </Button>
            <Link
              href={`/projects/${id}`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('back')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-6" />

      <div className="mt-6">
        <PhotoUpload
          projectId={id}
          onSuccess={() => setSuccess(true)}
        />
      </div>
    </div>
  )
}

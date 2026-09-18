'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import DefectBoard from '@/components/defects/DefectBoard'
import BackButton from '@/components/BackButton'

export default function DefectsPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('defects')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      {/* Header */}
      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-6" />

      {/* DefectBoard */}
      <div className="mt-8">
        <DefectBoard projectId={id} />
      </div>
    </div>
  )
}

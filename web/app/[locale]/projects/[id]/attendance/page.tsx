'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import AttendancePanel from '@/components/AttendancePanel'
import BackButton from '@/components/BackButton'

export default function AttendancePage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('attendance')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <BackButton href={`/projects/${id}`} label={t('back')} />

      {/* Header */}
      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-6" />

      {/* AttendancePanel */}
      <div className="mt-8">
        <AttendancePanel projectId={id} />
      </div>
    </div>
  )
}

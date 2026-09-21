'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import MembersPanel from '@/components/MembersPanel'
import BackButton from '@/components/BackButton'
import { PageHeader } from '@/components/ui/page-header'

export default function MembersPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('projectMembers')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href={`/projects/${id}`} label={t('back')} />

      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-6" />

      <div className="mt-8">
        <MembersPanel projectId={id} />
      </div>
    </div>
  )
}

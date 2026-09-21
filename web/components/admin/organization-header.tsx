'use client'

import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/ui/skeleton'

interface OrganizationHeaderProps {
  orgName: string | null
  isLoading?: boolean
}

function OrganizationHeader({ orgName, isLoading = false }: OrganizationHeaderProps) {
  const t = useTranslations('admin.commandCenter')

  if (isLoading) {
    return (
      <div role="status" aria-label={t('title')}>
        <Skeleton className="h-8 w-56 sm:h-9 sm:w-64" />
      </div>
    )
  }

  return (
    <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
      {orgName ?? t('title')}
    </h2>
  )
}

export { OrganizationHeader }

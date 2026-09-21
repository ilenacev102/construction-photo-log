'use client'

import { AlertTriangle, Clock, Info, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { AttentionItem, AttentionSeverity } from '@/lib/admin/overview'

const SEVERITY_ICONS: Record<AttentionSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: Clock,
  info: Info,
}

const SEVERITY_COLORS: Record<AttentionSeverity, string> = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
}

interface AttentionRequiredSectionProps {
  items: AttentionItem[]
  isLoading?: boolean
}

function AttentionRequiredSection({
  items,
  isLoading = false,
}: AttentionRequiredSectionProps) {
  const t = useTranslations('admin.commandCenter')

  const attentionTitle = (item: AttentionItem): string => {
    switch (item.kind) {
      case 'seats-near':
        return t('attention.seatsNear', { percent: item.percent ?? 0 })
      case 'seats-reached':
        return t('attention.seatsReached', { used: item.used ?? 0, limit: item.limit ?? 0 })
      case 'photos-near':
        return t('attention.photosNear', { percent: item.percent ?? 0 })
      case 'photos-reached':
        return t('attention.photosReached', { used: item.used ?? 0, limit: item.limit ?? 0 })
      case 'projects-near':
        return t('attention.projectsNear', { percent: item.percent ?? 0 })
      case 'projects-reached':
        return t('attention.projectsReached', { used: item.used ?? 0, limit: item.limit ?? 0 })
    }
  }

  if (isLoading) {
    return (
      <section aria-label={t('attention.title')} aria-busy="true">
        <h2 className="text-2xl font-semibold tracking-tight">{t('attention.title')}</h2>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section aria-label={t('attention.title')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('attention.title')}</h2>
        <EmptyState icon={Info} title={t('attention.empty')} className="py-12" />
      </section>
    )
  }

  return (
    <section aria-label={t('attention.title')}>
      <h2 className="text-2xl font-semibold tracking-tight">{t('attention.title')}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = SEVERITY_ICONS[item.severity]
          return (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-md border border-border bg-surface-sunken/50 p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon
                  className={cn('mt-0.5 size-4 shrink-0', SEVERITY_COLORS[item.severity])}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{attentionTitle(item)}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export { AttentionRequiredSection }

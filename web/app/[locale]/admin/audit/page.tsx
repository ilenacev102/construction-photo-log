'use client'

import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import AuditLogViewer from '@/components/AuditLogViewer'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export default function AdminAuditPage() {
  const t = useTranslations('auditLog')
  const common = useTranslations('common')
  const { isAdmin, isLoading } = useRole()

  // Loading
  if (isLoading) {
    return <LoadingBlock className="py-32" />
  }

  // Not admin — redirect
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{t('accessDenied')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('accessDeniedDesc')}
        </p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          {common('backToDashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* AuditLogViewer */}
      <div className="mt-8">
        <AuditLogViewer />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { getDashboardStats, getAuditLogs } from '@/lib/supabase/queries'
import { computeUsageMeters, buildAttentionItems } from '@/lib/admin/overview'
import { Link } from '@/i18n/navigation'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OrganizationHeader } from '@/components/admin/organization-header'
import { OrganizationUsageCard } from '@/components/admin/organization-usage-card'
import { AttentionRequiredSection } from '@/components/admin/attention-required-section'
import { QuickOperations } from '@/components/admin/quick-operations'
import { EffectivePermissionsView } from '@/components/admin/effective-permissions-view'
import { RecentAdminActivity } from '@/components/admin/recent-admin-activity'
import type { AuditLog } from '@/types/database'
import type { AdminStats } from '@/lib/admin/overview'

export default function AdminDashboardPage() {
  const cc = useTranslations('admin.commandCenter')
  const common = useTranslations('common')
  const { isAdmin, isManager, isLoading: roleLoading, profile } = useRole()

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalProjects: 0,
    totalPhotos: 0,
  })
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  useEffect(() => {
    if (roleLoading) return
    if (!isAdmin && !isManager) return

    let ignore = false

    const run = async () => {
      try {
        const [statsData, auditData] = await Promise.all([
          getDashboardStats(),
          getAuditLogs({ limit: 10 }),
        ])
        if (!ignore) {
          setStats({
            totalUsers: statsData.totalUsers,
            totalProjects: statsData.totalProjects,
            totalPhotos: statsData.totalPhotos,
          })
          setAuditLogs(auditData)
        }
      } catch {
        if (!ignore) setErrorKey('error')
      }
      if (!ignore) setDataLoading(false)
    }

    void run()

    return () => {
      ignore = true
    }
  }, [roleLoading, isAdmin, isManager])

  // Not admin or manager — decided before the loading state so denied
  // users never see a loader flash and no data fetch is issued for them.
  if (!roleLoading && !isAdmin && !isManager) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{common('accessDenied')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {common('accessDeniedDesc')}
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

  // Loading
  if (roleLoading || dataLoading) {
    return <LoadingBlock className="py-32" />
  }

  const meters = computeUsageMeters(stats)
  const attention = buildAttentionItems(meters)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-xl border border-border-strong bg-surface-raised p-6 shadow-elevation-2 sm:p-10">
        <div aria-hidden="true" className="absolute -right-12 -top-20 size-64 rounded-full border border-accent/20 bg-accent-muted/30" />
        <div className="relative"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent"><ShieldCheck className="size-4" /> {cc('governanceWorkspace')}</p><PageHeader className="mt-6" title={cc('title')} subtitle={cc('subtitle')} /></div>
      </section>

      {errorKey ? <ErrorAlert message={common(errorKey)} className="mt-6" /> : null}

      {/* Organization header */}
      <div className="mt-8">
        <OrganizationHeader orgName={profile?.company_name ?? null} />
      </div>

      {/* Usage meters */}
      <div className="mt-6">
        <OrganizationUsageCard meters={meters} />
      </div>

      {/* Attention required */}
      <div className="mt-6">
        <AttentionRequiredSection items={attention} />
      </div>

      {/* Quick operations */}
      <div className="mt-6">
        <QuickOperations />
      </div>

      {/* Effective permissions */}
      <div className="mt-6">
        <EffectivePermissionsView />
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <RecentAdminActivity logs={auditLogs} />
      </div>
    </div>
  )
}

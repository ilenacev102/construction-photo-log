'use client'

import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { usePathname } from '@/i18n/navigation'
import BackButton from '@/components/BackButton'
import { LoadingBlock } from '@/components/ui/loading-block'
import { AccessDenied } from '@/components/ui/access-denied'
import { TabNav } from '@/components/ui/tab-nav'

interface AdminTab {
  key: string
  href: string
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin')
  const common = useTranslations('common')
  const pathname = usePathname()
  const { isAdmin, isManager, isLoading } = useRole()

  const tabs: AdminTab[] = [
    { key: 'dashboard', href: '/admin' },
    { key: 'users', href: '/admin/users' },
    { key: 'team', href: '/admin/team' },
    { key: 'auditLog', href: '/admin/audit' },
    { key: 'labels', href: '/admin/labels' },
  ]

  const labels = Object.fromEntries(tabs.map((tab) => [tab.key, t(tab.key)]))

  if (isLoading) {
    return <LoadingBlock />
  }

  const isAllowed = isAdmin || (isManager && (pathname === '/admin/team' || pathname.startsWith('/admin/team/')))

  if (!isAllowed) {
    return (
      <AccessDenied
        title={t('accessDenied')}
        description={t('accessDeniedDesc')}
        backHref="/dashboard"
        backLabel={common('backToDashboard')}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in-up">
      {/* Back to dashboard */}
      <div className="mb-4">
        <BackButton href="/dashboard" label={common('backToDashboard')} />
      </div>

      {/* Admin navigation tabs */}
      <TabNav
        tabs={tabs}
        pathname={pathname}
        labels={labels}
        ariaLabel="Admin navigation"
        basePath="/admin"
      />

      {/* Page content */}
      <div className="mt-8">{children}</div>
    </div>
  )
}

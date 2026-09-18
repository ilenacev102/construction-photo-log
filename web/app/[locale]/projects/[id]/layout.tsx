'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { getProject } from '@/lib/supabase/queries'
import { useRole } from '@/hooks/useRole'
import type { Project } from '@/types/database'
import BackButton from '@/components/BackButton'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { TabNav } from '@/components/ui/tab-nav'
import MobileFieldNav from '@/components/MobileFieldNav'

// qrcode is a large client-only dependency; code-split it so the project
// layout's initial bundle doesn't include it.
const ProjectQRCode = dynamic(() => import('@/components/ProjectQRCode'), {
  ssr: false,
})

interface Tab {
  key: string
  href: string
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const id = params.id as string
  const pathname = usePathname()
  const tNav = useTranslations('projectNav')
  const tDetail = useTranslations('projectDetail')
  const { canManage, role } = useRole()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // The project is the shared source of truth, but each role sees a focused
  // workspace. This removes irrelevant operations from client and field views.
  const isClient = role === 'client'
  const isPhotographer = role === 'photographer'
  const isField = role === 'photographer' || role === 'foreman'
  const tabs: Tab[] = [
    { key: 'overview', href: `/projects/${id}` },
    { key: 'photos', href: `/projects/${id}/photos` },
    ...(isClient ? [] : [{ key: 'upload', href: `/projects/${id}/upload` }]),
    ...(!isClient && !isPhotographer ? [{ key: 'defects', href: `/projects/${id}/defects` }] : []),
    ...(role === 'foreman' || canManage ? [{ key: 'attendance', href: `/projects/${id}/attendance` }] : []),
    ...(!isClient ? [{ key: 'schema', href: `/projects/${id}/schema` }] : []),
    ...(!isClient && !isPhotographer ? [{ key: 'pins', href: `/projects/${id}/pins` }] : []),
    { key: 'report', href: `/projects/${id}/report` },
    ...(canManage ? [{ key: 'members', href: `/projects/${id}/members` }] : []),
  ]

  const labels = Object.fromEntries(tabs.map((tab) => [tab.key, tNav(tab.key)]))

  if (loading) {
    return <LoadingBlock />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {tDetail('back')}
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{tDetail('notFound')}</h2>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {tDetail('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in-up">
      {/* Back link */}
      <div className="mb-4">
        <BackButton href="/dashboard" label={tDetail('back')} />
      </div>

      {/* Project name + QR */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <ProjectQRCode projectId={id} projectName={project.name} variant="button" />
      </div>

      {/* Tab navigation */}
      <div className="mt-6">
        <TabNav
          tabs={tabs}
          pathname={pathname}
          labels={labels}
          ariaLabel={tNav('navAria')}
          basePath={`/projects/${id}`}
        />
      </div>

      {/* Page content */}
      <div className="mt-8 pb-16 md:pb-0">{children}</div>

      {/* Mobile field bottom navigation bar */}
      {isField ? <MobileFieldNav projectId={id} /> : null}
    </div>
  )
}

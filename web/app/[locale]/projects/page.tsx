'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { getProjects } from '@/lib/supabase/queries'
import { useRole } from '@/hooks/useRole'
import type { Project } from '@/types/database'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import ProjectCard from '@/components/ProjectCard'
import BackButton from '@/components/BackButton'
import { Search, FolderOpen } from 'lucide-react'

function matchesQuery(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    project.name.toLowerCase().includes(q) ||
    (project.address ?? '').toLowerCase().includes(q) ||
    (project.client_name ?? '').toLowerCase().includes(q)
  )
}

export default function ProjectsIndexPage() {
  const router = useRouter()
  const t = useTranslations('projects')
  const { canWrite } = useRole()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) => matchesQuery(p, query))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 xl:max-w-7xl">
      {/* Back link */}
      <BackButton href="/dashboard" label={t('back')} />

      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={canWrite ? <Button onClick={() => router.push('/projects/new')}>{t('newProject')}</Button> : undefined}
      />

      {/* Search */}
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('searchPlaceholder')}
        ariaLabel={t('search')}
        className="mt-6"
      />

      {/* Content */}
      <div className="mt-6">
        {loading && <LoadingBlock />}

        {error && <ErrorAlert>{t('error')}</ErrorAlert>}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={canWrite ? <Button className="mt-6" onClick={() => router.push('/projects/new')}>{t('emptyButton')}</Button> : undefined}
          />
        )}

        {!loading && !error && projects.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title={t('noResultsTitle')}
            description={t('noResultsDesc')}
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
            {filtered.map((project) => (
              <div key={project.id} className="min-w-0">
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

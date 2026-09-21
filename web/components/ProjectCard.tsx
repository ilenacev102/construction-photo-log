import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Project } from '@/types/database'
import { ChevronRight } from 'lucide-react'

interface ProjectCardProps {
  project: Project
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projectCard')

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-md border border-border bg-surface-raised p-5 shadow-elevation-1 transition-all duration-200 ease-apple-spring hover:-translate-y-0.5 hover:border-accent hover:shadow-elevation-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground truncate">
            {project.name}
          </h3>
          {project.address && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {project.address}
            </p>
          )}
          {project.client_name && (
            <p className="mt-0.5 font-mono text-[11px] text-tertiary-foreground">
              {t('client', { name: project.client_name })}
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-apple-spring group-hover:translate-x-1 group-hover:text-accent" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="font-mono text-[11px] text-tertiary-foreground tabular-nums">
          {t('created', { date: formatDate(project.created_at) })}
        </span>
        <span className="rounded-xs bg-accent-muted/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent uppercase">
          PROJECT ACTIVE
        </span>
      </div>
    </Link>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import type { Defect } from '@/types/database'
import { useDefects } from '@/hooks/useDefects'
import { TIER_STYLES, healthScoreFor, healthTierFor, type HealthTier } from '@/lib/health-tiers'
import { cn } from '@/lib/utils'

interface ProjectHealthScoreProps {
  projectId: string
  defects?: Defect[]
}

function HealthScorePill({ defects }: { defects: Defect[] }) {
  const t = useTranslations('projectHealth')

  const open = defects.filter((d) => d.status === 'open').length
  const inProgress = defects.filter((d) => d.status === 'in_progress').length
  const score = healthScoreFor(open, inProgress)
  const tier: HealthTier = healthTierFor(score)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
        TIER_STYLES[tier],
      )}
      aria-label={`${t('score')}: ${score}`}
    >
      <span className="font-semibold">{score}</span>
      <span>{t(tier)}</span>
    </span>
  )
}

function HealthScoreFetch({ projectId }: { projectId: string }) {
  const t = useTranslations('projectHealth')
  const { defects, isLoading } = useDefects({ projectId })

  if (isLoading) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
        {t('loading')}
      </span>
    )
  }

  return <HealthScorePill defects={defects} />
}

export function ProjectHealthScore({ projectId, defects }: ProjectHealthScoreProps) {
  if (defects) {
    return <HealthScorePill defects={defects} />
  }
  return <HealthScoreFetch projectId={projectId} />
}

'use client'

import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UsageMeter, UsageMeterTier } from '@/lib/admin/overview'
import { cn } from '@/lib/utils'

const TIER_BADGE_STYLES: Record<UsageMeterTier, string> = {
  ok: 'border-border bg-surface-sunken text-muted-foreground',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  critical: 'border-destructive/20 bg-destructive/10 text-destructive',
}

const TIER_BAR_STYLES: Record<UsageMeterTier, string> = {
  ok: 'bg-border-strong',
  warning: 'bg-warning',
  critical: 'bg-destructive',
}

interface OrganizationUsageCardProps {
  meters: UsageMeter[]
  isLoading?: boolean
}

function OrganizationUsageCard({ meters, isLoading = false }: OrganizationUsageCardProps) {
  const t = useTranslations('admin.commandCenter')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('meters.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label={t('meters.title')}>
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : meters.length > 0 ? (
          <ul className="space-y-4">
            {meters.map((meter) => (
              <MeterRow key={meter.key} meter={meter} />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MeterRow({ meter }: { meter: UsageMeter }) {
  const t = useTranslations('admin.commandCenter')
  const label = t(`meters.${meter.key}`)
  const value = meter.unlimited
    ? t('meters.unlimited')
    : t('meters.usedOf', { used: meter.used, limit: meter.limit ?? 0 })
  const tierLabel = t(`meters.tier.${meter.tier}`)

  return (
    <li className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
              TIER_BADGE_STYLES[meter.tier],
            )}
          >
            {tierLabel}
          </span>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={meter.percent}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn('h-full rounded-full', TIER_BAR_STYLES[meter.tier])}
          style={{ width: `${meter.percent}%` }}
        />
      </div>
    </li>
  )
}

export { OrganizationUsageCard }

'use client'

import { useTranslations } from 'next-intl'
import { Check, ShieldCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_CATEGORIES } from '@/types/database'
import { cn } from '@/lib/utils'

/**
 * Shows the permissions effectively granted to the current user's role,
 * grouped by category. Fetches effective permissions via `usePermissions`.
 */
function EffectivePermissionsView() {
  const t = useTranslations('admin.commandCenter')
  const { permissions, allPermissions, isLoading, error } = usePermissions()

  const granted = allPermissions.filter((p) => permissions.includes(p.key))

  const groups = granted.reduce<Record<string, typeof granted>>((acc, p) => {
    const label = PERMISSION_CATEGORIES[p.category] ?? p.category
    ;(acc[label] ??= []).push(p)
    return acc
  }, {})

  return (
    <section aria-label={t('permissions.title')}>
      <h2 className="text-2xl font-semibold tracking-tight">{t('permissions.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('permissions.subtitle')}</p>

      {isLoading ? (
        <div className="mt-4 space-y-3" role="status" aria-label={t('permissions.title')}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-56" />
        </div>
      ) : error ? (
        <ErrorAlert message={error} className="mt-4" />
      ) : granted.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('permissions.empty')} className="py-10" />
      ) : (
        <div className="mt-4 rounded-md border border-border bg-surface-raised p-4">
          <ul className="space-y-4">
            {Object.entries(groups).map(([category, perms]) => (
              <li key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </h3>
                <ul className="mt-2 space-y-1">
                  {perms.map((p) => (
                    <li key={p.key} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span>{p.name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
          >
            {t('permissions.viewAll')}
          </Link>
        </div>
      )}
    </section>
  )
}

export { EffectivePermissionsView }

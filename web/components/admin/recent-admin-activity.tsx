'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Activity } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AuditLog } from '@/types/database'

const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800',
  updated: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800',
  deleted: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800',
  resolved: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/30 dark:border-purple-800',
  check_in: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800',
  check_out: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-800',
}

// Match keys longest-first so a more specific verb (e.g. check_out vs check_in)
// always wins over a shorter substring match — deterministic regardless of order.
const ACTION_COLOR_KEYS = Object.keys(ACTION_COLORS).sort(
  (a, b) => b.length - a.length,
)

function getActionColor(action: string): string {
  for (const key of ACTION_COLOR_KEYS) {
    if (action.includes(key)) return ACTION_COLORS[key]
  }
  return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/30 dark:border-gray-800'
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface RecentAdminActivityProps {
  logs: AuditLog[]
  isLoading?: boolean
}

/**
 * Lists the most recent admin audit-log entries with a formatted timestamp,
 * the action and a human-readable entity label.
 */
function RecentAdminActivity({ logs, isLoading = false }: RecentAdminActivityProps) {
  const t = useTranslations('admin')
  const cc = useTranslations('admin.commandCenter')
  const audit = useTranslations('audit')
  const et = useTranslations('auditLog')
  const format = useFormatter()

  const entityLabel = (entityType: string): string =>
    et.has(`entity.${entityType}`) ? et(`entity.${entityType}`) : entityType

  return (
    <section aria-label={t('recentActivity')}>
      <h2 className="text-2xl font-semibold tracking-tight">{t('recentActivity')}</h2>

      {isLoading ? (
        <div className="mt-4 space-y-3" role="status" aria-label={t('recentActivity')}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title={t('noActivity')} className="py-10" />
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>{audit('date')}</TableHead>
                <TableHead>{audit('action')}</TableHead>
                <TableHead>{audit('entity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {format.dateTime(new Date(log.created_at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-xs border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${getActionColor(log.action)}`}
                    >
                      {formatAction(log.action)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entityLabel(log.entity_type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Link
            href="/admin/audit"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
          >
            {cc('activity.viewAll')}
          </Link>
        </div>
      )}
    </section>
  )
}

export { RecentAdminActivity }

'use client'

import { useState, useEffect, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { getAuditLogs } from '@/lib/supabase/queries'
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

const ENTITY_LABEL_KEYS: Record<string, string> = {
  project: 'entity.project',
  photo: 'entity.photo',
  daily_log: 'entity.dailyLog',
  defect: 'entity.defect',
  pin: 'entity.pin',
  attendance: 'entity.attendance',
  report: 'entity.report',
  profile: 'entity.profile',
}

const ACTION_FILTER_ENTITIES = ['project', 'photo', 'daily_log', 'defect', 'pin', 'attendance', 'report']
const ENTITY_FILTER_ENTITIES = [...ACTION_FILTER_ENTITIES, 'profile']

export default function AuditLogViewer() {
  const t = useTranslations('audit')
  const et = useTranslations('auditLog')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const PAGE_SIZE = 20

  useEffect(() => {
    let ignore = false
    const run = async () => {
      setIsLoading(true)
      try {
        const data = await getAuditLogs({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          actionFilter: actionFilter || undefined,
          entityFilter: entityFilter || undefined,
        })
        if (!ignore) setLogs(data)
      } catch {
        if (!ignore) setLogs([])
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [page, actionFilter, entityFilter])

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">{t('actionFilter')}</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
            className="mt-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">{t('all')}</option>
            {ACTION_FILTER_ENTITIES.map((value) => (
              <option key={value} value={value}>
                {et(ENTITY_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">{t('entityFilter')}</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0) }}
            className="mt-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">{t('all')}</option>
            {ENTITY_FILTER_ENTITIES.map((value) => (
              <option key={value} value={value}>
                {et(ENTITY_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg aria-hidden="true" className="mb-3 size-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && logs.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border-strong bg-surface-raised shadow-elevation-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono">
                <th className="px-4 py-3 text-left font-semibold text-foreground uppercase">{t('date')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground uppercase">{t('action')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground uppercase">{t('entity')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground uppercase">{t('user')}</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground uppercase">{t('id')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className="cursor-pointer border-b border-border/60 transition-colors duration-150 ease-apple-spring hover:bg-surface-sunken/60"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-tertiary-foreground tabular-nums">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-xs border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${getActionColor(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="break-words px-4 py-3 font-medium text-foreground uppercase text-[11px]">{log.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-tertiary-foreground tabular-nums">
                      {log.user_id?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-accent font-semibold tabular-nums">
                      {log.entity_id?.slice(0, 8)}...
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-meta`} className="bg-surface-sunken/80">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="rounded-xs border border-border bg-background p-3 font-mono text-[11px] text-foreground">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('page')} {page + 1}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
            >
              {t('prev')}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

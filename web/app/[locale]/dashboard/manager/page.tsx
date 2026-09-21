'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { getDashboardStats, getAuditLogs, getProjects } from '@/lib/supabase/queries'
import { Link } from '@/i18n/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { ArrowUpRight, ClipboardCheck, FolderOpen, ShieldAlert, UsersRound } from 'lucide-react'
import {
  ATTENDANCE_FETCH_LIMIT,
  AUDIT_LOG_FETCH_LIMIT,
  RECENT_AUDIT_LOG_COUNT,
  TODAY_ATTENDANCE_SLICE,
  USER_ID_PREFIX_LENGTH,
  isOpenDefect,
  isCriticalDefect,
} from '@/lib/dashboard'
import type { AttendanceLog, AuditLog, Defect, Project } from '@/types/database'

export default function ManagerDashboardPage() {
  const t = useTranslations('managerDashboard')
  const dt = useTranslations('dashboard')
  const ct = useTranslations('common')
  const at = useTranslations('auditLog')
  const auditHeader = useTranslations('audit')
  const wt = useTranslations('workOrders')
  const { profile, role, isLoading: roleLoading } = useRole()

  const [defects, setDefects] = useState<Defect[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState({ totalProjects: 0, totalPhotos: 0, totalDefects: 0, totalUsers: 0 })
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const handleRetry = () => {
    setLoadError(false)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    if (roleLoading) return

    let ignore = false

    const run = async () => {
      try {
        const [statsData, allDefects, allAttendance, projectsData] = await Promise.all([
          getDashboardStats(),
          fetch('/api/defects', { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as Defect[] : j.data as Defect[]),
          fetch(`/api/attendance?limit=${ATTENDANCE_FETCH_LIMIT}`, { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as AttendanceLog[] : j.data as AttendanceLog[]),
          getProjects(),
        ])

        if (!ignore) {
          setStats(statsData)
          setDefects((allDefects ?? []) as Defect[])
          setAttendanceLogs((allAttendance ?? []) as AttendanceLog[])
          setProjects((projectsData ?? []) as Project[])
        }
      } catch {
        if (!ignore) setLoadError(true)
      }

      try {
        const auditData = await getAuditLogs({ limit: AUDIT_LOG_FETCH_LIMIT })
        if (!ignore) setAuditLogs(auditData as AuditLog[])
      } catch {
        if (!ignore) setLoadError(true)
      }

      if (!ignore) setDataLoading(false)
    }

    void run()

    return () => { ignore = true }
  }, [roleLoading, reloadKey])

  if (roleLoading || dataLoading) {
    return <LoadingBlock className="py-32" />
  }

  // Only site_manager and admin
  if (role !== 'site_manager' && role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{ct('accessDenied')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dt('managerAccessDeniedDesc')}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-xs border border-accent/30 bg-accent-muted/40 px-3.5 py-1.5 text-xs font-semibold text-accent transition-all duration-180 ease-apple-spring hover:bg-accent-muted/70"
        >
          {ct('backToDashboard')}
        </Link>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const teamToday = new Set(
    attendanceLogs
      .filter((l) => l.check_in.startsWith(today) && !l.check_out)
      .map((l) => l.user_id),
  )
  const openDefects = defects.filter(isOpenDefect)
  const criticalDefects = defects.filter(isCriticalDefect)
  const todayAttendance = attendanceLogs.filter(
    (l) => l.check_in.startsWith(today),
  )
  const defectCounts = {
    open: defects.filter((d) => d.status === 'open').length,
    in_progress: defects.filter((d) => d.status === 'in_progress').length,
    resolved: defects.filter((d) => d.status === 'resolved').length,
    closed: defects.filter((d) => d.status === 'closed').length,
  }
  const recentAudits = auditLogs.slice(0, RECENT_AUDIT_LOG_COUNT)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {loadError && (
        <ErrorAlert className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span>{ct('error')} {t('loadError')}</span>
            <Button size="sm" variant="outline" onClick={handleRetry}>{ct('retry')}</Button>
          </div>
        </ErrorAlert>
      )}
      <section className="grid overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-elevation-2 lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent"><ClipboardCheck className="size-4" /> {t('siteControlRoom')}</p><PageHeader className="mt-6" title={t('title')} subtitle={t('subtitle')} />{profile && <p className="mt-4 text-sm text-muted-foreground">{dt('greeting', { name: profile.full_name })}</p>}<div className="mt-8 flex flex-wrap gap-3"><Link href="/work-orders" className={cn(buttonVariants({ variant: 'default' }))}>{wt('title')} <ArrowUpRight className="size-4" /></Link><Link href="/admin/team" className={cn(buttonVariants({ variant: 'outline' }))}>{t('teamManagement')}</Link></div></div>
        <div className="relative border-t border-border bg-surface-sunken p-6 lg:border-l lg:border-t-0 sm:p-10"><div className="absolute right-8 top-8 size-24 rounded-full border border-accent/20" /><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('prioritySignal')}</p><p className="mt-5 max-w-xs text-2xl font-semibold tracking-tight">{criticalDefects.length ? t('criticalItemsCount', { count: criticalDefects.length }) : t('noCriticalIssues')}</p><div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground"><ShieldAlert className="size-4 text-accent" /> {t('qualityAttendanceView')}</div></div>
      </section>

      {/* Stats grid */}
      <div className="mt-6 grid overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
        <StatCard variant="divider" label={t('totalProjects')} value={stats.totalProjects} />
        <StatCard variant="divider" label={t('openDefects')} value={openDefects.length} />
        <StatCard variant="divider" label={t('criticalDefects')} value={criticalDefects.length} />
        <StatCard variant="divider" label={t('teamToday')} value={`${teamToday.size} ${t('people')}`} />
      </div>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/projects" className={cn(buttonVariants({ variant: 'default' }))}>
          {t('viewAllProjects')}
        </Link>
        <Link
          href={projects[0] ? `/projects/${projects[0].id}/defects` : '/projects/new'}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          {t('defectBoard')}
        </Link>
        <Link
          href={projects[0] ? `/projects/${projects[0].id}/attendance` : '/projects/new'}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          {t('attendanceReport')}
        </Link>
        <Link href="/admin/team" className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('teamManagement')}
        </Link>
        <Link href="/work-orders" className={cn(buttonVariants({ variant: 'outline' }))}>
          {wt('title')}
        </Link>
      </div>

      {/* Two-column layout for defects + attendance */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Defects by status */}
        <div className="rounded-xl border border-border bg-surface-raised p-6 shadow-elevation-1">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('defectsByStatus')}</h2><ShieldAlert className="size-4 text-accent" /></div>
          <div className="mt-4 space-y-2">
            {([
              { key: 'open' as const, label: t('open'), color: 'text-red-600' },
              { key: 'in_progress' as const, label: t('inProgress'), color: 'text-amber-600' },
              { key: 'resolved' as const, label: t('resolved'), color: 'text-emerald-600' },
              { key: 'closed' as const, label: t('closed'), color: 'text-muted-foreground' },
            ]).map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <span className={`size-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                  {label}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {defectCounts[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's attendance */}
        <div className="rounded-xl border border-border bg-surface-raised p-6 shadow-elevation-1">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('todayAttendance')}</h2><UsersRound className="size-4 text-accent" /></div>
          {todayAttendance.length === 0 ? (
            <EmptyState icon={FolderOpen} title={t('noAttendance')} className="py-8" />
          ) : (
            <ul className="mt-4 space-y-2">
              {todayAttendance.slice(0, TODAY_ATTENDANCE_SLICE).map((log) => (
                <li key={log.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {log.user_id.slice(0, USER_ID_PREFIX_LENGTH)}...
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('traceability')}</p><h2 className="mt-2 text-lg font-semibold">{t('recentActivity')}</h2>
        {recentAudits.length === 0 ? (
          <EmptyState icon={FolderOpen} title={t('noActivity')} className="py-8" />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {dt('auditLog')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {at('action')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {auditHeader('entity')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentAudits.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{at(`actions.${log.action}`)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {at(`entities.${log.entity_type}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { getProjects } from '@/lib/supabase/queries'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { ArrowUpRight, Camera, CheckCircle2, ClipboardList, FileImage, FolderOpen } from 'lucide-react'
import type { Project, Photo, AttendanceLog, Defect, WorkOrder, WorkOrderStatus } from '@/types/database'

export default function WorkerDashboardPage() {
  const t = useTranslations('workerDashboard')
  const wt = useTranslations('workOrders')
  const dt = useTranslations('dashboard')
  const ct = useTranslations('common')
  const { profile, role, isLoading: roleLoading, isForeman } = useRole()

  const [projects, setProjects] = useState<Project[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [defects, setDefects] = useState<Defect[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
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
        const [projectsData, allPhotos, allAttendance, allDefects, allWorkOrders] = await Promise.all([
          getProjects(),
          fetch('/api/photos', { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as Photo[] : j.data as Photo[]),
          fetch('/api/attendance?limit=200', { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as AttendanceLog[] : j.data as AttendanceLog[]),
          fetch('/api/defects', { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as Defect[] : j.data as Defect[]),
          fetch('/api/work-orders?assignedTo=me', { credentials: 'include' }).then(r => r.json()).then(j => j.error ? [] as WorkOrder[] : j.data as WorkOrder[]),
        ])
        if (!ignore) {
          setProjects((projectsData ?? []) as Project[])
          setPhotos((allPhotos ?? []) as Photo[])
          setAttendanceLogs((allAttendance ?? []) as AttendanceLog[])
          setDefects((allDefects ?? []) as Defect[])
          setWorkOrders((allWorkOrders ?? []) as WorkOrder[])
        }
      } catch {
        if (!ignore) setLoadError(true)
      }
      if (!ignore) setDataLoading(false)
    }

    void run()

    return () => { ignore = true }
  }, [roleLoading, reloadKey])

  async function handleWorkOrderStatus(id: string, status: WorkOrderStatus) {
    try {
      const res = await fetch('/api/work-orders', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWorkOrders((prev) => prev.map((wo) => (wo.id === id ? json.data : wo)))
    } catch {
      // ignore
    }
  }

  if (roleLoading || dataLoading) {
    return <LoadingBlock className="py-32" />
  }

  // Only photographers and foremen
  if (role !== 'photographer' && role !== 'foreman') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{ct('accessDenied')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dt('workerAccessDeniedDesc')}
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
  const checkedIn = attendanceLogs.some(
    (log) => log.user_id === profile?.id && log.check_in.startsWith(today) && !log.check_out,
  )
  const myPhotos = photos.filter((p) => p.user_id === profile?.id).slice(0, 5)
  const myProjects = projects
  const openDefects = defects.filter(
    (d) => d.status === 'open' || d.status === 'in_progress',
  )
  const teamToday = new Set(
    attendanceLogs
      .filter((l) => l.check_in.startsWith(today) && !l.check_out)
      .map((l) => l.user_id),
  )
  const firstUploadHref = myProjects[0]
    ? `/projects/${myProjects[0].id}/upload`
    : '/projects/new'
  const firstDefectsHref = myProjects[0]
    ? `/projects/${myProjects[0].id}/defects`
    : '/projects/new'
  const firstDailyLogHref = myProjects[0]
    ? `/projects/${myProjects[0].id}`
    : '/projects/new'

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
      <section className="relative overflow-hidden rounded-xl border border-border-strong bg-surface-raised p-6 shadow-elevation-2 sm:p-10">
        <div className="absolute -right-16 -top-16 size-56 rounded-full border border-accent/20 bg-accent-muted/25" />
        <div className="relative"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent"><Camera className="size-4" /> Field workspace</p><PageHeader className="mt-6" title={t('title')} subtitle={t('subtitle')} />{profile && <p className="mt-4 text-sm text-muted-foreground">{dt('greeting', { name: profile.full_name })}</p>}<div className="mt-8 flex flex-wrap gap-3"><Link href={firstUploadHref} className={cn(buttonVariants({ variant: 'default' }))}>{t('addPhoto')} <ArrowUpRight className="size-4" /></Link><Link href="/work-orders" className={cn(buttonVariants({ variant: 'outline' }))}>{wt('myWorkOrders')}</Link></div></div>
      </section>

      {/* Stats */}
      <div className="mt-6 grid overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
        <StatCard
          variant="divider"
          label={t('checkInStatus')}
          value={checkedIn ? t('checkedIn') : t('notCheckedIn')}
        />
        <StatCard variant="divider" label={t('myProjects')} value={myProjects.length} />
        <StatCard variant="divider" label={t('openDefects')} value={openDefects.length} />
        <StatCard
          variant="divider"
          label={wt('openWorkOrders')}
          value={workOrders.filter((wo) => wo.status === 'pending' || wo.status === 'in_progress').length}
        />
        {isForeman ? (
          <StatCard variant="divider" label={t('teamOnSite')} value={`${teamToday.size} ${t('people')}`} />
        ) : (
          <StatCard variant="divider" label={dt('addPhoto')} value={myPhotos.length} />
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Today&apos;s run</p><h2 className="mt-2 text-lg font-semibold">{dt('quickActions')}</h2>
        <p className="text-sm text-muted-foreground">{dt('quickActionsDesc')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={firstUploadHref} className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
            {t('addPhoto')}
          </Link>
          <Link href={firstDefectsHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {t('reportDefect')}
          </Link>
          <Link href={firstDailyLogHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {t('dailyLog')}
          </Link>
        </div>
      </div>

      {/* Work orders */}
      <div className="mt-10">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Execution</p><h2 className="mt-2 text-lg font-semibold">{wt('myWorkOrders')}</h2></div><CheckCircle2 className="size-5 text-accent" /></div>
        {(() => {
          const myOrders = workOrders.filter((wo) => wo.status !== 'done' && wo.status !== 'cancelled')
          if (myOrders.length === 0) {
            return <EmptyState icon={ClipboardList} title={wt('noWorkOrders')} className="py-8" />
          }
          return (
            <>
              {myOrders.map((wo) => {
                const projectName = myProjects.find((p) => p.id === wo.project_id)?.name
                const overdue = wo.due_date && wo.due_date < today
                return (
                  <div
                    key={wo.id}
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-5 shadow-elevation-1 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{wo.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {projectName}
                        {wo.due_date && ` · ${wo.due_date}`}
                        {overdue && (
                          <span className="ml-2 text-xs font-semibold text-red-600">{wt('overdue')}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {wo.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => handleWorkOrderStatus(wo.id, 'in_progress')}>
                          {wt('start')}
                        </Button>
                      )}
                      {wo.status === 'in_progress' && (
                        <Button size="sm" variant="outline" onClick={() => handleWorkOrderStatus(wo.id, 'done')}>
                          {wt('finish')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
              <Link href="/work-orders" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                {wt('title')}
              </Link>
            </>
          )
        })()}
      </div>

      {/* Recent uploads */}
      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Evidence</p><h2 className="mt-2 text-lg font-semibold">{t('myUploads')}</h2>
        {myPhotos.length === 0 ? (
          <EmptyState icon={FileImage} title={t('noUploads')} className="py-8" />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {myPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <Image
                  src={photo.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My projects */}
      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Assigned scope</p><h2 className="mt-2 text-lg font-semibold">{t('myProjects')}</h2>
        <p className="text-sm text-muted-foreground">{t('myProjectsDesc')}</p>
        {myProjects.length === 0 ? (
          <EmptyState icon={FolderOpen} title={dt('emptyTitle')} className="py-8" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {myProjects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="min-w-0 rounded-xl border border-border bg-surface-raised p-5 shadow-elevation-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken"
              >
                <p className="text-sm font-medium">{project.name}</p>
                {project.client_name && (
                  <p className="mt-1 text-xs text-muted-foreground">{project.client_name}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

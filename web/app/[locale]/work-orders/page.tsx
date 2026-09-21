'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { getProjects } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { AccessDenied } from '@/components/ui/access-denied'
import { ClipboardList, Plus } from 'lucide-react'
import { WorkOrderCreateForm } from '@/components/work-orders/WorkOrderCreateForm'
import { WorkOrderDetail } from '@/components/work-orders/WorkOrderDetail'
import { WorkOrderList } from '@/components/work-orders/WorkOrderList'
import type { Profile, Project, WorkOrderStatus, Defect } from '@/types/database'

const STATUS_ORDER: WorkOrderStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

export default function WorkOrdersPage() {
  const t = useTranslations('workOrders')
  const pt = useTranslations('projects')
  const ct = useTranslations('common')
  const { role, canWrite, isLoading: roleLoading } = useRole()

  const isManager = role === 'site_manager' || role === 'admin'
  const isWorker = role === 'photographer' || role === 'foreman'

  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [allDefects, setAllDefects] = useState<Defect[]>([])
  const [linkedDefectsMap, setLinkedDefectsMap] = useState<Record<string, Defect[]>>({})
  const [defectsVisibleSet, setDefectsVisibleSet] = useState<Set<string>>(new Set())
  const [prevFilterKey, setPrevFilterKey] = useState('')

  const {
    workOrders,
    isLoading,
    error,
    createWorkOrder,
    updateStatus,
    updateWorkOrder,
    deleteWorkOrder,
  } = useWorkOrders({
    projectId: projectFilter !== 'all' ? projectFilter : undefined,
    statusFilter,
    assignedTo: isManager && assigneeFilter !== 'all' ? assigneeFilter : undefined,
  })

  useEffect(() => {
    if (roleLoading) return
    let ignore = false
    const run = async () => {
      try {
        const [projectsData, teamData] = await Promise.all([
          getProjects(),
          fetch('/api/team', { credentials: 'include' })
            .then((r) => r.json())
            .then((j) => (j.error ? [] as Profile[] : j.data as Profile[])),
        ])
        if (!ignore) {
          setProjects((projectsData ?? []) as Project[])
          setTeam((teamData ?? []) as Profile[])
        }
      } catch {
        // ignore
      }
      if (!ignore) setDataLoading(false)
    }
    void run()
    return () => {
      ignore = true
    }
  }, [roleLoading])

  // Reset linked-defect state whenever a filter changes. Done during render with a
  // previous-value guard (React's documented "adjusting state when a prop changes"
  // pattern) because the old setState-in-effect version trips the react-hooks rule.
  const filterKey = `${projectFilter}|${statusFilter}|${assigneeFilter}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setLinkedDefectsMap({})
    setDefectsVisibleSet(new Set())
  }

  useEffect(() => {
    if (roleLoading || dataLoading) return
    let ignore = false
    const pid = projectFilter !== 'all' ? projectFilter : projects[0]?.id
    if (!pid) return
    fetch(`/api/defects?projectId=${pid}`)
      .then((r) => r.json())
      .then((j) => { if (!ignore) setAllDefects(j.data ?? []) })
      .catch(() => { if (!ignore) setAllDefects([]) })
    return () => { ignore = true }
  }, [roleLoading, dataLoading, projectFilter, projects])

  const fetchLinkedDefects = useCallback(async (woId: string) => {
    try {
      const res = await fetch(`/api/work-orders/${woId}/defects`, { credentials: 'include' })
      const json = await res.json()
      setLinkedDefectsMap((prev) => ({ ...prev, [woId]: json.data ?? [] }))
    } catch {
      setLinkedDefectsMap((prev) => ({ ...prev, [woId]: [] }))
    }
  }, [])

  const handleToggleDefects = useCallback((woId: string) => {
    setDefectsVisibleSet((prev) => {
      const next = new Set(prev)
      if (next.has(woId)) {
        next.delete(woId)
      } else {
        next.add(woId)
        void fetchLinkedDefects(woId)
      }
      return next
    })
  }, [fetchLinkedDefects])

  const handleLinkDefect = useCallback(async (woId: string, defectId: string) => {
    await fetch(`/api/work-orders/${woId}/defects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ defectId }),
    })
    await fetchLinkedDefects(woId)
  }, [fetchLinkedDefects])

  const handleUnlinkDefect = useCallback(async (woId: string, defectId: string) => {
    await fetch(`/api/work-orders/${woId}/defects?defectId=${defectId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await fetchLinkedDefects(woId)
  }, [fetchLinkedDefects])

  if (roleLoading || dataLoading) {
    return <LoadingBlock className="py-32" />
  }

  if (role === 'client' || (!isManager && !isWorker)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AccessDenied
          title={ct('accessDenied')}
          description={ct('accessDeniedDesc')}
          backHref="/dashboard"
          backLabel={ct('backToDashboard')}
        />
      </div>
    )
  }

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name
  const memberName = (id: string | null) => (id ? team.find((m) => m.id === id)?.full_name : undefined)

  const editingOrder = editingId ? workOrders.find((w) => w.id === editingId) : undefined

  const handleCreate = async (input: Parameters<typeof createWorkOrder>[0]) => {
    setActionError(null)
    try {
      await createWorkOrder(input)
      setShowCreate(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create work order')
    }
  }

  const handleUpdate = async (input: Parameters<typeof updateWorkOrder>[1]) => {
    if (!editingId) return
    setActionError(null)
    try {
      await updateWorkOrder(editingId, input)
      setEditingId(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update work order')
    }
  }

  const handleStatus = async (id: string, status: WorkOrderStatus) => {
    setActionError(null)
    try {
      await updateStatus(id, status)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    setActionError(null)
    try {
      await deleteWorkOrder(id)
      if (editingId === id) setEditingId(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete work order')
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          isManager ? (
            <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
              <Plus className="size-4" />
              {t('newWorkOrder')}
            </Button>
          ) : undefined
        }
      />

      {actionError ? <ErrorAlert message={actionError} className="mt-6" /> : null}
      {error && !isLoading ? <ErrorAlert message={error} className="mt-6" /> : null}

      {isManager ? (
        <>
          {/* Filter bar */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="wo-filter-project" className="text-sm font-medium">
                {pt('title')}
              </label>
              <select
                id="wo-filter-project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className={inputClass}
              >
                <option value="all">{t('allWorkOrders')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wo-filter-status" className="text-sm font-medium">
                {t('statusLabel')}
              </label>
              <select
                id="wo-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | 'all')}
                className={inputClass}
              >
                <option value="all">{t('allWorkOrders')}</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wo-filter-assignee" className="text-sm font-medium">
                {t('assigneeLabel')}
              </label>
              <select
                id="wo-filter-assignee"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className={inputClass}
              >
                <option value="all">{t('allWorkOrders')}</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Create form */}
          {showCreate ? (
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <WorkOrderCreateForm
                projects={projects}
                team={team}
                defaultProjectId={projectFilter !== 'all' ? projectFilter : projects[0]?.id}
                submitLabel={t('save')}
                onSubmit={handleCreate}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          ) : null}

          {/* Edit form */}
          {editingOrder ? (
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <WorkOrderCreateForm
                projects={projects}
                team={team}
                initial={editingOrder}
                submitLabel={t('save')}
                onSubmit={handleUpdate}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {/* List */}
      <div className="mt-8">
        {isLoading ? (
          <LoadingBlock className="py-16" />
        ) : workOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('noWorkOrders')} className="py-12" />
        ) : (
          <WorkOrderList workOrders={workOrders}>
            {(wo) => (
              <WorkOrderDetail
                workOrder={wo}
                projectName={projectName(wo.project_id)}
                assigneeName={memberName(wo.assigned_to)}
                isManager={isManager}
                onStatusChange={(status) => handleStatus(wo.id, status)}
                onEdit={
                  isManager
                    ? () => {
                        setEditingId(editingId === wo.id ? null : wo.id)
                        setShowCreate(false)
                      }
                    : undefined
                }
                onDelete={isManager ? () => handleDelete(wo.id) : undefined}
                linkedDefects={linkedDefectsMap[wo.id] ?? []}
                allDefects={allDefects}
                canWrite={canWrite}
                showDefects={defectsVisibleSet.has(wo.id)}
                onToggleDefects={() => handleToggleDefects(wo.id)}
                onLinkDefect={(defectId) => handleLinkDefect(wo.id, defectId)}
                onUnlinkDefect={(defectId) => handleUnlinkDefect(wo.id, defectId)}
              />
            )}
          </WorkOrderList>
        )}
      </div>
    </div>
  )
}

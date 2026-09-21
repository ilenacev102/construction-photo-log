'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Pencil, Trash2 } from 'lucide-react'
import { CommentThread } from '@/components/comments/CommentThread'
import { WorkOrderDefectLinker } from '@/components/work-orders/WorkOrderDefectLinker'
import type { WorkOrderPriority, WorkOrderStatus, WorkOrder, Defect } from '@/types/database'

const statusStyles: Record<WorkOrderStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-700',
  in_progress: 'bg-blue-500/10 text-blue-700',
  done: 'bg-emerald-500/10 text-emerald-700',
  cancelled: 'bg-muted text-muted-foreground',
}

const priorityStyles: Record<WorkOrderPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-700',
  high: 'bg-red-500/10 text-red-700',
}

export interface WorkOrderDetailProps {
  workOrder: WorkOrder
  projectName?: string
  assigneeName?: string
  isManager: boolean
  onStatusChange: (status: WorkOrderStatus) => void
  onEdit?: () => void
  onDelete?: () => void
  linkedDefects: Defect[]
  allDefects: Defect[]
  canWrite: boolean
  showDefects: boolean
  onToggleDefects: () => void
  onLinkDefect: (defectId: string) => Promise<void>
  onUnlinkDefect: (defectId: string) => Promise<void>
}

export function WorkOrderDetail({
  workOrder,
  projectName,
  assigneeName,
  isManager,
  onStatusChange,
  onEdit,
  onDelete,
  linkedDefects,
  allDefects,
  canWrite,
  showDefects,
  onToggleDefects,
  onLinkDefect,
  onUnlinkDefect,
}: WorkOrderDetailProps) {
  const t = useTranslations('workOrders')
  const [showComments, setShowComments] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const overdue =
    workOrder.due_date !== null &&
    workOrder.due_date < today &&
    workOrder.status !== 'done' &&
    workOrder.status !== 'cancelled'

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{workOrder.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {projectName ? <span>{projectName}</span> : null}
            {assigneeName ? <span>{assigneeName}</span> : null}
            {workOrder.due_date ? (
              <span className={overdue ? 'font-semibold text-red-600' : undefined}>
                {workOrder.due_date}
                {overdue ? ` · ${t('overdue')}` : ''}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              priorityStyles[workOrder.priority],
            )}
          >
            {t(`priority.${workOrder.priority}`)}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              statusStyles[workOrder.status],
            )}
          >
            {t(`status.${workOrder.status}`)}
          </span>
        </div>
      </div>

      {workOrder.description ? (
        <p className="mt-3 text-sm text-muted-foreground">{workOrder.description}</p>
      ) : null}
      {workOrder.location ? (
        <p className="mt-2 text-xs text-muted-foreground">{workOrder.location}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          💬 {showComments ? t('hideComments') : t('showComments')}
        </button>
        <button
          onClick={onToggleDefects}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          🔗 {showDefects ? t('hideDefects') : t('showDefects')}
          {linkedDefects.length > 0 && ` (${linkedDefects.length})`}
        </button>
        {workOrder.status === 'pending' ? (
          <Button size="xs" onClick={() => onStatusChange('in_progress')}>
            {t('start')}
          </Button>
        ) : null}
        {workOrder.status === 'in_progress' ? (
          <Button size="xs" onClick={() => onStatusChange('done')}>
            {t('finish')}
          </Button>
        ) : null}
        {isManager && (workOrder.status === 'pending' || workOrder.status === 'in_progress') ? (
          <Button size="xs" variant="ghost" onClick={() => onStatusChange('cancelled')}>
            {t('cancel')}
          </Button>
        ) : null}
        {isManager && onEdit ? (
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil className="size-3.5" />
            {t('edit')}
          </Button>
        ) : null}
        {isManager && onDelete ? (
          <Button size="xs" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            {t('delete')}
          </Button>
        ) : null}
      </div>

      {showComments && (
        <div className="mt-3 border-t border-border pt-3">
          <CommentThread
            projectId={workOrder.project_id}
            entityType="work_order"
            entityId={workOrder.id}
          />
        </div>
      )}

      {showDefects && (
        <div className="mt-3 border-t border-border pt-3">
          <WorkOrderDefectLinker
            linkedDefects={linkedDefects}
            allDefects={allDefects}
            canWrite={canWrite}
            onLink={onLinkDefect}
            onUnlink={onUnlinkDefect}
          />
        </div>
      )}
    </div>
  )
}

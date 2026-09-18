'use client'

import { useTranslations } from 'next-intl'
import { LabelBadge } from '@/components/labels/LabelBadge'
import type { Label } from '@/hooks/useLabels'
import type { Defect, DefectStatus, DefectSeverity, Photo, WorkOrder } from '@/types/database'
import { DefectDetail } from './DefectDetail'

const SEVERITY_STYLES: Record<DefectSeverity, string> = {
  low: 'bg-surface-sunken text-muted-foreground border-border font-mono text-[11px] font-semibold uppercase tracking-wider',
  medium: 'bg-info/10 text-info border-info/30 font-mono text-[11px] font-semibold uppercase tracking-wider',
  high: 'bg-warning/15 text-warning border-warning/40 font-mono text-[11px] font-semibold uppercase tracking-wider',
  critical: 'bg-destructive/15 text-destructive border-destructive/40 font-mono text-[11px] font-bold uppercase tracking-wider animate-pulse',
}

export function DefectCard({
  defect,
  canWrite,
  isExpanded,
  labels,
  photos,
  projectPhotos,
  loadingProjectPhotos,
  photoPickerDefectId,
  linkedWorkOrders,
  projectId,
  onToggleExpand,
  onStatusChange,
  onOpenPhotoPicker,
  onAttachPhoto,
  onDetachPhoto,
}: {
  defect: Defect
  canWrite: boolean
  isExpanded: boolean
  labels: Label[]
  photos: Photo[]
  projectPhotos: Photo[]
  loadingProjectPhotos: boolean
  photoPickerDefectId: string | null
  linkedWorkOrders: WorkOrder[]
  projectId: string
  onToggleExpand: () => void
  onStatusChange: (defectId: string, status: DefectStatus) => void
  onOpenPhotoPicker: (defectId: string) => void
  onAttachPhoto: (defectId: string, photoId: string) => void
  onDetachPhoto: (defectId: string, photoId: string) => void
}) {
  const t = useTranslations('defects')

  return (
    <div
      className="cursor-pointer rounded-md border border-border bg-surface-raised p-3.5 shadow-elevation-1 transition-all duration-180 ease-apple-spring hover:-translate-y-0.5 hover:border-accent hover:shadow-elevation-2"
      onClick={onToggleExpand}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[defect.severity]}`}>
          {defect.severity}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium">{defect.title}</p>
      {defect.location && (
        <p className="mt-0.5 text-xs text-muted-foreground">{defect.location}</p>
      )}
      {defect.due_date && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('dueDate')}: {new Date(defect.due_date).toLocaleDateString()}
        </p>
      )}

      {/* Labels */}
      {labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {labels.map((label) => (
            <LabelBadge key={label.id} label={label} size="sm" />
          ))}
        </div>
      )}

      {/* Quick actions (shown always for canWrite) */}
      {canWrite && defect.status !== 'closed' && (
        <div className="mt-2 flex gap-1">
          {defect.status === 'open' && (
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); onStatusChange(defect.id, 'in_progress') }}
            >
              {t('start')}
            </button>
          )}
          {defect.status === 'in_progress' && (
            <button
              className="text-xs text-green-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); onStatusChange(defect.id, 'resolved') }}
            >
              {t('resolve')}
            </button>
          )}
          {defect.status === 'resolved' && (
            <button
              className="text-xs text-gray-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); onStatusChange(defect.id, 'closed') }}
            >
              {t('close')}
            </button>
          )}
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={(e) => { e.stopPropagation(); onStatusChange(defect.id, 'open') }}
          >
            {t('reopen')}
          </button>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <DefectDetail
          defect={defect}
          canWrite={canWrite}
          photos={photos}
          projectPhotos={projectPhotos}
          loadingProjectPhotos={loadingProjectPhotos}
          photoPickerDefectId={photoPickerDefectId}
          linkedWorkOrders={linkedWorkOrders}
          projectId={projectId}
          onOpenPhotoPicker={onOpenPhotoPicker}
          onAttachPhoto={onAttachPhoto}
          onDetachPhoto={onDetachPhoto}
        />
      )}
    </div>
  )
}
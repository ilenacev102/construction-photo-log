'use client'

import { useTranslations } from 'next-intl'
import type { Label } from '@/hooks/useLabels'
import type { Defect, DefectStatus, Photo, WorkOrder } from '@/types/database'
import { DefectCard } from './DefectCard'

export function DefectColumn({
  title,
  count,
  defects,
  labelsByDefect,
  expandedId,
  canWrite,
  photosByDefect,
  projectPhotos,
  loadingProjectPhotos,
  photoPickerDefectId,
  linkedWorkOrdersByDefect,
  projectId,
  onToggleExpand,
  onStatusChange,
  onAttachPhoto,
  onDetachPhoto,
  onOpenPhotoPicker,
}: {
  title: string
  count: number
  defects: Defect[]
  labelsByDefect: Record<string, Label[]>
  expandedId: string | null
  canWrite: boolean
  photosByDefect: Record<string, Photo[]>
  projectPhotos: Photo[]
  loadingProjectPhotos: boolean
  photoPickerDefectId: string | null
  linkedWorkOrdersByDefect: Record<string, WorkOrder[]>
  projectId: string
  onToggleExpand: (defectId: string) => void
  onStatusChange: (defectId: string, status: DefectStatus) => void
  onAttachPhoto: (defectId: string, photoId: string) => void
  onDetachPhoto: (defectId: string, photoId: string) => void
  onOpenPhotoPicker: (defectId: string) => void
}) {
  const t = useTranslations('defects')

  return (
    <div className="rounded-xl border border-border bg-muted/20">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="max-h-[500px] space-y-2 overflow-y-auto p-2">
        {defects.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {defects.map((defect) => (
          <DefectCard
            key={defect.id}
            defect={defect}
            canWrite={canWrite}
            isExpanded={expandedId === defect.id}
            labels={labelsByDefect[defect.id] ?? []}
            photos={photosByDefect[defect.id] ?? []}
            projectPhotos={projectPhotos}
            loadingProjectPhotos={loadingProjectPhotos}
            photoPickerDefectId={photoPickerDefectId}
            linkedWorkOrders={linkedWorkOrdersByDefect[defect.id] ?? []}
            projectId={projectId}
            onToggleExpand={() => onToggleExpand(defect.id)}
            onStatusChange={onStatusChange}
            onOpenPhotoPicker={onOpenPhotoPicker}
            onAttachPhoto={onAttachPhoto}
            onDetachPhoto={onDetachPhoto}
          />
        ))}
      </div>
    </div>
  )
}
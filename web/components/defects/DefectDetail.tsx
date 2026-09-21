'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { CommentThread } from '@/components/comments/CommentThread'
import type { Defect, Photo, WorkOrder } from '@/types/database'

export function DefectDetail({
  defect,
  canWrite,
  photos,
  projectPhotos,
  loadingProjectPhotos,
  photoPickerDefectId,
  linkedWorkOrders,
  projectId,
  onOpenPhotoPicker,
  onAttachPhoto,
  onDetachPhoto,
}: {
  defect: Defect
  canWrite: boolean
  photos: Photo[]
  projectPhotos: Photo[]
  loadingProjectPhotos: boolean
  photoPickerDefectId: string | null
  linkedWorkOrders: WorkOrder[]
  projectId: string
  onOpenPhotoPicker: (defectId: string) => void
  onAttachPhoto: (defectId: string, photoId: string) => void
  onDetachPhoto: (defectId: string, photoId: string) => void
}) {
  const t = useTranslations('defects')

  return (
    <>
      <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
        {defect.description && <p className="mb-1">{defect.description}</p>}
        {defect.resolution_notes && (
          <p className="mb-1">{t('resolution')}: {defect.resolution_notes}</p>
        )}

        {/* Photo gallery */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium">{t('photos')} ({defect.photo_ids.length})</span>
            {canWrite && (
              <button
                className="text-xs text-accent hover:underline"
                onClick={(e) => { e.stopPropagation(); void onOpenPhotoPicker(defect.id) }}
              >
                {t('attachPhoto')}
              </button>
            )}
          </div>
          {photos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative size-16 overflow-hidden rounded border border-border">
                  <Image
                    src={photo.image_url}
                    alt={photo.note || ''}
                    width={64}
                    height={64}
                    className="size-full object-cover"
                  />
                  {canWrite && (
                    <button
                      className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-bl bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); void onDetachPhoto(defect.id, photo.id) }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/60">{t('noPhotos')}</p>
          )}
        </div>

        {/* Photo picker dropdown */}
        {photoPickerDefectId === defect.id && (
          <div
            className="relative z-30 mt-2 rounded-lg border border-border bg-surface-raised p-2 shadow-elevation-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1.5 text-[11px] font-medium">{t('selectPhoto')}</p>
            {loadingProjectPhotos ? (
              <div className="flex items-center justify-center py-3">
                <span className="size-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
              </div>
            ) : projectPhotos.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-muted-foreground">{t('noProjectPhotos')}</p>
            ) : (
              <div className="max-h-40 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {projectPhotos
                    .filter((p) => !defect.photo_ids.includes(p.id))
                    .map((photo) => (
                      <button
                        key={photo.id}
                        className="size-12 overflow-hidden rounded border border-border transition-all hover:border-accent hover:ring-1 hover:ring-accent"
                        onClick={() => void onAttachPhoto(defect.id, photo.id)}
                      >
                        <Image
                          src={photo.image_url}
                          alt={photo.note || ''}
                          width={48}
                          height={48}
                          className="size-full object-cover"
                        />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {linkedWorkOrders.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium">{t('linkedWorkOrders')}</p>
            <div className="flex flex-col gap-1">
              {linkedWorkOrders.map((wo) => (
                <span key={wo.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {wo.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-1">{new Date(defect.created_at).toLocaleDateString()}</p>
      </div>

      {/* Comments */}
      <div className="pointer-events-auto mt-3">
        <CommentThread
          projectId={projectId}
          entityType="defect"
          entityId={defect.id}
        />
      </div>
    </>
  )
}
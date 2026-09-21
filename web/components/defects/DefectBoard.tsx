'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLabels } from '@/hooks/useLabels'
import type { Label } from '@/hooks/useLabels'
import { LabelFilterBar } from '@/components/labels/LabelFilterBar'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useDefects } from '@/hooks/useDefects'
import { useRole } from '@/hooks/useRole'
import type { Defect, DefectStatus, DefectSeverity, Photo, WorkOrder } from '@/types/database'
import { DefectColumn } from './DefectColumn'
import { DefectCreateModal } from './DefectCreateModal'

interface DefectBoardProps {
  projectId: string
}

const COLUMNS: { status: DefectStatus; titleKey: string }[] = [
  { status: 'open', titleKey: 'open' },
  { status: 'in_progress', titleKey: 'inProgress' },
  { status: 'resolved', titleKey: 'resolved' },
  { status: 'closed', titleKey: 'closed' },
]

async function fetchFilteredDefects(projectId: string, labelSlugs: string[]): Promise<Defect[] | null> {
  const res = await fetch(`/api/defects?projectId=${projectId}&labelSlugs=${labelSlugs.join(',')}`)
  const json = await res.json()
  return (json.data as Defect[] | undefined) ?? null
}

export default function DefectBoard({ projectId }: DefectBoardProps) {
  const t = useTranslations('defects')
  const { defects, isLoading, createDefect, updateStatus, updatePhotoIds } = useDefects({ projectId })
  const { canWrite } = useRole()
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { groups } = useLabels()
  const [labelFilters, setLabelFilters] = useState<Record<string, string[]>>({})
  const [defectLabels, setDefectLabels] = useState<Record<string, Label[]>>({})
  const [filteredDefects, setFilteredDefects] = useState<Defect[] | null>(null)
  const [defectPhotos, setDefectPhotos] = useState<Record<string, Photo[]>>({})
  const [photoPickerDefectId, setPhotoPickerDefectId] = useState<string | null>(null)
  const [projectPhotos, setProjectPhotos] = useState<Photo[]>([])
  const [loadingProjectPhotos, setLoadingProjectPhotos] = useState(false)
  const [defectWorkOrders, setDefectWorkOrders] = useState<Record<string, WorkOrder[]>>({})

  function getColumnDefects(status: DefectStatus): Defect[] {
    const source = filteredDefects ?? defects
    return source.filter((d) => d.status === status)
  }

  function handleToggleExpand(defectId: string) {
    setExpandedId((prev) => (prev === defectId ? null : defectId))
  }

  async function handleCreate(data: { title: string; description?: string; severity?: DefectSeverity; location?: string; labelIds: string[] }) {
    const defect = await createDefect(data)
    if (defect && data.labelIds?.length) {
      await Promise.all(data.labelIds.map(labelId =>
        fetch('/api/taggings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label_id: labelId, taggable_type: 'defect', taggable_id: defect.id }),
        })
      ))
      const res = await fetch(`/api/taggings?taggable_type=defect&taggable_id=${defect.id}`)
      const json = await res.json()
      if (json.data) {
        const labels: Label[] = json.data.map((t: { labels: Label }) => t.labels)
        setDefectLabels(prev => ({ ...prev, [defect.id]: labels }))
      }
    }
  }

  async function handleStatusChange(defectId: string, status: DefectStatus) {
    await updateStatus(defectId, status)
  }

  // Fetch labels for all defects in one batched request (no per-defect N+1).
  useEffect(() => {
    if (!defects.length) return
    let cancelled = false
    ;(async () => {
      try {
        const ids = defects.map((d) => d.id).join(',')
        const res = await fetch(
          `/api/taggings?taggable_type=defect&taggable_ids=${encodeURIComponent(ids)}`,
        )
        const json = await res.json()
        const map: Record<string, Label[]> = {}
        for (const item of json.data ?? []) {
          if (item.taggable_id && item.labels) {
            ;(map[item.taggable_id] ??= []).push(item.labels as Label)
          }
        }
        if (!cancelled) setDefectLabels(map)
      } catch {
        if (!cancelled) setDefectLabels({})
      }
    })()
    return () => { cancelled = true }
  }, [defects])

  useEffect(() => {
    if (!expandedId) return
    const defect = defects.find((d) => d.id === expandedId)
    if (!defect) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/photos?projectId=${projectId}`)
        const json = await res.json()
        if (cancelled) return
        const allPhotos: Photo[] = json.data ?? []
        const linked = defect.photo_ids.length === 0
          ? []
          : allPhotos.filter((p) => defect.photo_ids.includes(p.id))
        setDefectPhotos((prev) => ({ ...prev, [expandedId]: linked }))
      } catch {
        if (!cancelled) setDefectPhotos((prev) => ({ ...prev, [expandedId]: [] }))
      }
    })()
    return () => { cancelled = true }
  }, [expandedId, defects, projectId])

  // Fetch linked work orders when a defect is expanded
  useEffect(() => {
    if (!expandedId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/defects/${expandedId}/work-orders`)
        const json = await res.json()
        if (!cancelled) {
          setDefectWorkOrders(prev => ({ ...prev, [expandedId]: json.data ?? [] }))
        }
      } catch {
        if (!cancelled) {
          setDefectWorkOrders(prev => ({ ...prev, [expandedId]: [] }))
        }
      }
    })()
    return () => { cancelled = true }
  }, [expandedId])

  const openPhotoPicker = useCallback(async (defectId: string) => {
    setPhotoPickerDefectId(defectId)
    if (projectPhotos.length > 0) return
    setLoadingProjectPhotos(true)
    try {
      const res = await fetch(`/api/photos?projectId=${projectId}`)
      const json = await res.json()
      setProjectPhotos(json.data ?? [])
    } finally {
      setLoadingProjectPhotos(false)
    }
  }, [projectPhotos.length, projectId])

  const handleAttachPhoto = useCallback(async (defectId: string, photoId: string) => {
    await updatePhotoIds(defectId, 'add', photoId)
    setPhotoPickerDefectId(null)
  }, [updatePhotoIds])

  const handleDetachPhoto = useCallback(async (defectId: string, photoId: string) => {
    await updatePhotoIds(defectId, 'remove', photoId)
  }, [updatePhotoIds])

  // Filter defects by label slugs
  useEffect(() => {
    const activeSlugs = Object.values(labelFilters).flat()
    let ignore = false
    const run = async () => {
      if (activeSlugs.length === 0) {
        if (!ignore) setFilteredDefects(null)
        return
      }
      try {
        const data = await fetchFilteredDefects(projectId, activeSlugs)
        if (!ignore) setFilteredDefects(data)
      } catch {
        if (!ignore) setFilteredDefects(null)
      }
    }
    void run()
    return () => { ignore = true }
  }, [projectId, labelFilters])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('defectBoard')}</h2>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            {t('addDefect')}
          </Button>
        )}
      </div>

      {/* Label filters */}
      {groups.length > 0 && (
        <div className="mb-4">
          <LabelFilterBar
            groups={groups}
            activeFilters={labelFilters}
            onChange={(groupId, slugs) => setLabelFilters(prev => ({ ...prev, [groupId]: slugs }))}
          />
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const colDefects = getColumnDefects(col.status)
          return (
            <div key={col.status} className="min-w-0">
              <DefectColumn
                title={t(col.titleKey)}
                count={colDefects.length}
                defects={colDefects}
                labelsByDefect={defectLabels}
                expandedId={expandedId}
                canWrite={canWrite}
                photosByDefect={defectPhotos}
                projectPhotos={projectPhotos}
                loadingProjectPhotos={loadingProjectPhotos}
                photoPickerDefectId={photoPickerDefectId}
                linkedWorkOrdersByDefect={defectWorkOrders}
                projectId={projectId}
                onToggleExpand={handleToggleExpand}
                onStatusChange={handleStatusChange}
                onAttachPhoto={handleAttachPhoto}
                onDetachPhoto={handleDetachPhoto}
                onOpenPhotoPicker={openPhotoPicker}
              />
            </div>
          )
        })}
      </div>

      {/* Add defect modal */}
      <DefectCreateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
      />
    </div>
  )
}
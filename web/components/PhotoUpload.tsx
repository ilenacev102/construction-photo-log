'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { extractExif } from '@/lib/exif'
import { Button } from '@/components/ui/button'
import { useLabels } from '@/hooks/useLabels'
import { LabelPicker } from '@/components/labels/LabelPicker'
import type { Label } from '@/hooks/useLabels'
import { monitoring } from '@/lib/monitoring'
import { getOutboxStore } from '@/lib/offline/store'
import { isOnline } from '@/lib/offline/sync'
import { useOutboxSync } from '@/hooks/useOutboxSync'

interface PhotoUploadProps {
  projectId: string
  onSuccess: () => void
}

type ItemStatus = 'pending' | 'uploading' | 'done' | 'queued' | 'error'

interface BatchItem {
  id: number
  file: File
  previewUrl: string
  status: ItemStatus
  error: string | null
}

export default function PhotoUpload({ projectId, onSuccess }: PhotoUploadProps) {
  const t = useTranslations('photoUpload')
  const ct = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)
  const liveUrls = useRef<Set<string>>(new Set())
  const [items, setItems] = useState<BatchItem[]>([])
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])

  const { groups } = useLabels()
  const { pendingCount, refresh: refreshQueue } = useOutboxSync()

  useEffect(() => {
    const urls = liveUrls.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  function trackUrl(url: string): string {
    liveUrls.current.add(url)
    return url
  }

  function revokeAll() {
    liveUrls.current.forEach((u) => URL.revokeObjectURL(u))
    liveUrls.current.clear()
  }

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    revokeAll()
    setItems(
      files.map((file) => {
        idCounter.current += 1
        return {
          id: idCounter.current,
          file,
          previewUrl: trackUrl(URL.createObjectURL(file)),
          status: 'pending' as ItemStatus,
          error: null,
        }
      }),
    )
  }

  function removeItem(id: number) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
        liveUrls.current.delete(target.previewUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }

  async function uploadOne(
    item: BatchItem,
    sharedNote: string,
    sharedLabels: Label[],
  ): Promise<'done' | 'queued'> {
    const exif = await extractExif(item.file)

    if (!isOnline()) {
      await getOutboxStore().enqueue({
        projectId,
        blob: item.file,
        fileName: item.file.name,
        mimeType: item.file.type || 'image/jpeg',
        note: sharedNote || null,
        takenAt: exif.takenAt,
        latitude: exif.latitude,
        longitude: exif.longitude,
      })
      return 'queued'
    }

    const formData = new FormData()
    formData.append('file', item.file)
    formData.append('projectId', projectId)
    formData.append('note', sharedNote)
    formData.append('takenAt', exif.takenAt ?? '')
    if (exif.latitude != null) formData.append('latitude', String(exif.latitude))
    if (exif.longitude != null) formData.append('longitude', String(exif.longitude))

    let res: Response
    try {
      res = await fetch('/api/upload', { method: 'POST', body: formData })
    } catch (err) {
      if (!isOnline() || err instanceof TypeError) {
        await getOutboxStore().enqueue({
          projectId,
          blob: item.file,
          fileName: item.file.name,
          mimeType: item.file.type || 'image/jpeg',
          note: sharedNote || null,
          takenAt: exif.takenAt,
          latitude: exif.latitude,
          longitude: exif.longitude,
        })
        return 'queued'
      }
      throw err
    }

    if (!res.ok) {
      let errorMsg = t('errorUpload')
      try {
        const body = await res.json()
        errorMsg = body.error ?? errorMsg
      } catch {
        // Response body is not JSON; use fallback error message
      }
      throw new Error(errorMsg)
    }

    const { data } = await res.json()
    const photoId = data.photoId

    const taggingResults = await Promise.allSettled(
      sharedLabels.map(async (label) => {
        const tagRes = await fetch('/api/taggings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label_id: label.id,
            taggable_type: 'photo',
            taggable_id: photoId,
          }),
        })
        if (!tagRes.ok) throw new Error(`tagging failed: ${tagRes.status}`)
        return tagRes.json()
      }),
    )
    const failedTaggings = taggingResults.filter((r) => r.status === 'rejected')
    if (failedTaggings.length > 0) {
      monitoring.captureException(
        new Error(`${failedTaggings.length} taggings failed for photo ${photoId}`),
        { extra: { component: 'PhotoUpload', projectId } },
      )
      throw new Error(t('tagsPartialFail'))
    }
    return 'done'
  }

  async function handleUpload() {
    const batch = items.filter((i) => i.status === 'pending' || i.status === 'error')
    if (batch.length === 0 || uploading) return

    const sharedNote = note
    const sharedLabels = selectedLabels
    setUploading(true)

    let doneCount = 0
    for (const item of batch) {
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: 'uploading', error: null } : p)),
      )
      try {
        const outcome = await uploadOne(item, sharedNote, sharedLabels)
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: outcome } : p)),
        )
        if (outcome === 'done') doneCount += 1
      } catch (err) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: 'error', error: err instanceof Error ? err.message : t('errorUpload') }
              : p,
          ),
        )
        monitoring.captureException(err, { extra: { component: 'PhotoUpload', projectId } })
      }
    }

    setUploading(false)
    refreshQueue()
    if (doneCount > 0) {
      revokeAll()
      setItems([])
      setNote('')
      setSelectedLabels([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess()
    }
  }

  function handleReset() {
    revokeAll()
    setItems([])
    setNote('')
    setSelectedLabels([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'error')
  const finishedCount = items.filter((i) => i.status === 'done' || i.status === 'queued').length
  const activeItem = items.find((i) => i.status === 'uploading')
  const queuedItems = items.filter((i) => i.status === 'queued').length

  return (
    <div className="space-y-5">
      {pendingCount > 0 && (
        <div className="rounded-xs border border-accent/30 bg-accent-muted/40 p-3 text-xs font-semibold text-accent">
          {t('pendingSync', { count: pendingCount })}
        </div>
      )}
      {queuedItems > 0 && (
        <div className="rounded-xs border border-accent/30 bg-accent-muted/40 p-3 text-xs font-semibold text-accent">
          {t('queuedDesc')}
        </div>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFilesSelect}
      />

      {/* Upload area (shown when no files selected) */}
      {items.length === 0 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-md border-2 border-dashed border-border bg-surface-sunken px-6 py-12 text-center transition-all duration-200 ease-apple-spring hover:border-accent hover:bg-surface-raised hover:shadow-elevation-2"
        >
          <div className="grid size-12 place-items-center rounded-xs border border-accent/30 bg-accent-muted/40 text-accent">
            <svg
              className="size-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t('dropzone')}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {t('dropzoneHint')} · EXIF TAMPER-PROOF AUTO-EXTRACT
            </p>
          </div>
        </button>
      )}

      {/* Batch list + shared form */}
      {items.length > 0 && (
        <div className="space-y-4">
          {/* Selected files */}
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-sm border border-border bg-surface-sunken p-2.5"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xs border border-border/80 bg-background">
                  <Image
                    src={item.previewUrl}
                    alt={t('previewAlt')}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.status === 'uploading' && t('uploading', { current: finishedCount + 1, total: items.length })}
                    {item.status === 'done' && '✓'}
                    {item.status === 'queued' && t('queuedDesc')}
                    {item.status === 'pending' && `${(item.file.size / 1024 / 1024).toFixed(1)} MB`}
                    {item.status === 'error' && (item.error ?? t('errorUpload'))}
                  </p>
                </div>
                {!uploading && item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded-xs px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    aria-label={ct('cancel')}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Shared note field */}
          <div>
            <label
              htmlFor="photo-note"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t('noteLabel')}
            </label>
            <textarea
              id="photo-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              className="mt-1 block w-full resize-none rounded-sm border border-border bg-surface-sunken px-3.5 py-2.5 text-sm text-foreground placeholder:text-tertiary-foreground outline-none transition-all duration-180 ease-apple-spring focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent-muted/40 disabled:opacity-50"
              disabled={uploading}
            />
          </div>

          {/* Shared labels */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('labels')}
            </span>
            <div className="mt-1">
              <LabelPicker
                groups={groups}
                selected={selectedLabels}
                onChange={setSelectedLabels}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="cta"
              size="lg"
              onClick={handleUpload}
              disabled={uploading || pendingItems.length === 0}
              className="flex-1 shadow-elevation-2"
            >
              {uploading || activeItem ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('uploading', { current: finishedCount + 1, total: items.length })}
                </span>
              ) : (
                t('uploadButton', { count: pendingItems.length })
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              disabled={uploading}
            >
              {ct('cancel')}
            </Button>
            {!uploading && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
              >
                +
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

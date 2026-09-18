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

export default function PhotoUpload({ projectId, onSuccess }: PhotoUploadProps) {
  const t = useTranslations('photoUpload')
  const ct = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])

  const { groups } = useLabels()
  const { pendingCount, refresh: refreshQueue } = useOutboxSync()

  // Object URLs pin the full file Blob in memory — release on change/unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
  }

  async function handleUpload() {
    if (!selectedFile) return

    setUploading(true)
    setError(null)
    setQueued(false)

    const exif = await extractExif(selectedFile)

    try {
      // Offline: persist to the outbox, the sync engine uploads on reconnect.
      if (!isOnline()) {
        await getOutboxStore().enqueue({
          projectId,
          blob: selectedFile,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'image/jpeg',
          note: note || null,
          takenAt: exif.takenAt,
          latitude: exif.latitude,
          longitude: exif.longitude,
        })
        refreshQueue()
        setQueued(true)
        handleReset()
        return
      }

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', projectId)
      formData.append('note', note)
      formData.append('takenAt', exif.takenAt ?? '')
      if (exif.latitude != null) formData.append('latitude', String(exif.latitude))
      if (exif.longitude != null) formData.append('longitude', String(exif.longitude))

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

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
        selectedLabels.map(async (label) => {
          const res = await fetch('/api/taggings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label_id: label.id,
              taggable_type: 'photo',
              taggable_id: photoId,
            }),
          })
          if (!res.ok) throw new Error(`tagging failed: ${res.status}`)
          return res.json()
        }),
      )
      const failedTaggings = taggingResults.filter((r) => r.status === 'rejected')
      if (failedTaggings.length > 0) {
        monitoring.captureException(
          new Error(`${failedTaggings.length} taggings failed for photo ${photoId}`),
          { extra: { component: 'PhotoUpload', projectId } },
        )
        setError(t('tagsPartialFail'))
      }

      onSuccess()
    } catch (err) {
      // Network died mid-upload: queue the file instead of failing.
      if (selectedFile && (!isOnline() || err instanceof TypeError)) {
        try {
          await getOutboxStore().enqueue({
            projectId,
            blob: selectedFile,
            fileName: selectedFile.name,
            mimeType: selectedFile.type || 'image/jpeg',
          note: note || null,
          takenAt: exif.takenAt,
          latitude: exif.latitude,
          longitude: exif.longitude,
        })
        refreshQueue()
        setQueued(true)
        handleReset()
        return
        } catch {
          // Outbox write failed — fall through to the error message.
        }
      }
      setError(err instanceof Error ? err.message : t('errorUpload'))
    } finally {
      setUploading(false)
    }
  }

  function handleReset() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setNote('')
    setSelectedLabels([])
    setError(null)
    setQueued(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5">
      {pendingCount > 0 && (
        <div className="rounded-xs border border-accent/30 bg-accent-muted/40 p-3 text-xs font-semibold text-accent">
          {t('pendingSync', { count: pendingCount })}
        </div>
      )}
      {queued && (
        <div className="rounded-xs border border-accent/30 bg-accent-muted/40 p-3 text-xs font-semibold text-accent">
          {t('queuedDesc')}
        </div>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload area (shown when no file selected) */}
      {!selectedFile && (
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

      {/* Preview + note form (shown when file selected) */}
      {selectedFile && previewUrl && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="relative h-80 w-full overflow-hidden rounded-md border border-border bg-surface-sunken">
            <Image
              src={previewUrl}
              alt={t('previewAlt')}
              fill
              unoptimized
              className="object-contain"
            />
          </div>

          {/* Note field */}
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

          {/* Labels */}
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

          {/* Error message */}
          {error && (
            <div className="rounded-xs border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="cta"
              size="lg"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 shadow-elevation-2"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('uploading', { current: 1, total: 1 })}
                </span>
              ) : (
                t('uploadButton', { count: 1 })
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
          </div>
        </div>
      )}
    </div>
  )
}

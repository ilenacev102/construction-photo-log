'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Photo } from '@/types/database'
import { Button } from '@/components/ui/button'
import { useLocale, useTranslations } from 'next-intl'

interface ReportBuilderProps {
  projectId: string
  photos: Photo[]
  onComplete: (pdfUrl: string, manifestId: string | null) => void
}

export default function ReportBuilder({
  projectId,
  photos,
  onComplete,
}: ReportBuilderProps) {
  const t = useTranslations('report')
  const tc = useTranslations('photoCard')
  const locale = useLocale()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePhoto(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(photos.map((p) => p.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          photoIds: Array.from(selectedIds),
          title: title || t('fallbackTitle'),
          language: locale,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? t('error'))
      }

      onComplete(data.data.pdf_url, data.data.manifest_id ?? null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('error')
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Title input */}
      <div>
        <label
          htmlFor="report-title"
          className="block text-sm font-medium text-foreground"
        >
          {t('reportTitle')}
        </label>
        <input
          id="report-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={generating}
        />
      </div>

      {/* Selection controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('selected', { count: selectedIds.size, total: photos.length })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={generating}
          >
            {t('selectAll')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={generating}
          >
            {t('deselectAll')}
          </Button>
        </div>
      </div>

      {/* Photo grid with checkboxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {photos.map((photo) => {
          const isSelected = selectedIds.has(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => togglePhoto(photo.id)}
              disabled={generating}
              className={`min-w-0 group relative overflow-hidden rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-foreground/30'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <Image
                  src={photo.image_url}
                  alt={photo.note ?? tc('fallbackAlt')}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Checkbox overlay */}
              <div
                className={`absolute right-2 top-2 flex size-5 items-center justify-center rounded border-2 bg-background transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/50'
                }`}
              >
                {isSelected && (
                  <svg
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Note */}
              <div className="p-2">
                {photo.note && (
                  <p className="text-xs text-foreground line-clamp-1">
                    {photo.note}
                  </p>
                )}
                {!photo.note && (
                  <p className="text-xs text-muted-foreground">
                    {t('noNote')}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Generate button */}
      <div className="flex justify-end">
        <Button
          onClick={handleGenerate}
          disabled={selectedIds.size === 0 || generating}
          className="min-w-40"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t('generating')}
            </span>
          ) : (
            t('generate')
          )}
        </Button>
      </div>
    </div>
  )
}
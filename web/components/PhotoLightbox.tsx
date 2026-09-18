'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import type { Photo, Defect } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CommentThread } from '@/components/comments/CommentThread'

export interface PhotoLightboxProps {
  photos: Photo[]
  index: number | null
  onClose: () => void
  onNavigate?: (index: number) => void
  onDelete?: (id: string) => void | Promise<void>
}

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  onDelete,
}: PhotoLightboxProps) {
  const t = useTranslations('photoLightbox')
  const locale = useLocale()
  const total = photos.length
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [showDefectPicker, setShowDefectPicker] = useState(false)
  const [defects, setDefects] = useState<Defect[]>([])
  const [loadingDefects, setLoadingDefects] = useState(false)
  const [linkingDefectId, setLinkingDefectId] = useState<string | null>(null)
  const defectPickerRef = useRef<HTMLDivElement>(null)

  // Keyboard arrow navigation
  useEffect(() => {
    if (index === null) return
    const current = index
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if (current > 0) onNavigate?.(current - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (current < total - 1) onNavigate?.(current + 1)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, total, onNavigate])

  useEffect(() => {
    if (!showDefectPicker) return
    const handler = (e: MouseEvent) => {
      if (defectPickerRef.current && !defectPickerRef.current.contains(e.target as Node)) {
        setShowDefectPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDefectPicker])

  const photo = index !== null ? photos[index] : null

  const fetchDefects = useCallback(async () => {
    if (!photo || defects.length > 0) return
    setLoadingDefects(true)
    try {
      const res = await fetch(`/api/defects?projectId=${photo.project_id}`)
      const json = await res.json()
      if (json.data) setDefects(json.data as Defect[])
    } finally {
      setLoadingDefects(false)
    }
  }, [photo, defects.length])

  const handleAttachToDefect = useCallback(async (defectId: string) => {
    if (!photo) return
    setLinkingDefectId(defectId)
    try {
      const res = await fetch(`/api/defects/${defectId}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', photoId: photo.id }),
      })
      const json = await res.json()
      if (!json.error) {
        setShowDefectPicker(false)
      }
    } finally {
      setLinkingDefectId(null)
    }
  }, [photo])

  if (index === null || !photo) return null

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(photo.id)
    try {
      await onDelete(photo.id)
    } finally {
      setDeleting(null)
    }
    if (photos.length <= 1) onClose()
  }

  const hasPrev = index > 0
  const hasNext = index < total - 1

  const dateLabel = photo.taken_at ?? photo.created_at
  const formattedDate = dateLabel
    ? new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(dateLabel))
    : ''

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90" />
        <DialogContent
          showClose={false}
          className="fixed inset-0 z-50 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center rounded-none border-none bg-transparent p-0 shadow-none duration-150"
        >
          <DialogTitle className="sr-only">
            {photo.note || t('of', { current: index + 1, total })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {formattedDate || 'Construction photo viewer'}
          </DialogDescription>

          {/* Backdrop click to close */}
          <div
            className="absolute inset-0 z-0"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Image + caption */}
          <div className="relative z-10 flex h-full items-center justify-center px-4 py-4 pointer-events-none">
            <figure className="flex max-h-full flex-col items-center gap-3 pointer-events-auto">
              <Image
                src={photo.image_url}
                alt={photo.note ?? ''}
                width={0}
                height={0}
                sizes="90vw"
                draggable={false}
                priority
                className="h-auto max-h-[80vh] w-auto max-w-[90vw] rounded-xl object-contain shadow-2xl"
              />
              <figcaption className="max-w-2xl text-center">
                {photo.note && <p className="text-sm text-white/90">{photo.note}</p>}
                {formattedDate && (
                  <p
                    className={cn(
                      'text-xs',
                      photo.note ? 'text-white/60' : 'text-white/90',
                    )}
                  >
                    {formattedDate}
                  </p>
                )}
              </figcaption>
            </figure>
          </div>

          {/* Close button (top-right) */}
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter (top-left) */}
          <div className="absolute left-4 top-4 z-20 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
            {t('of', { current: index + 1, total })}
          </div>

          {/* Navigation arrows */}
          {hasPrev && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigate?.(index - 1)
              }}
              className="absolute left-4 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('previous')}
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {hasNext && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigate?.(index + 1)
              }}
              className="absolute right-4 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('next')}
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Toggle comments (bottom-center) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowComments(!showComments)
            }}
            aria-label={t('comments')}
            className="absolute bottom-4 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </button>

          {/* Attach to defect (bottom-center-right) */}
          <div className="absolute bottom-4 left-1/2 z-20 ml-8" ref={defectPickerRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const next = !showDefectPicker
                setShowDefectPicker(next)
                if (next) void fetchDefects()
              }}
              aria-label={t('attachToDefect')}
              className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.856-2.07a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
              </svg>
            </button>
            {showDefectPicker && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-12 left-0 w-64 rounded-xl border border-white/15 bg-black/80 shadow-xl backdrop-blur-md"
              >
                <div className="border-b border-white/10 px-3 py-2">
                  <p className="text-xs font-medium text-white/90">{t('attachToDefect')}</p>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {loadingDefects ? (
                    <div className="flex items-center justify-center py-4">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                    </div>
                  ) : defects.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-white/50">{t('noDefects')}</p>
                  ) : (
                    defects.map((defect) => (
                      <button
                        key={defect.id}
                        onClick={() => void handleAttachToDefect(defect.id)}
                        disabled={linkingDefectId === defect.id}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        {linkingDefectId === defect.id ? (
                          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                        ) : (
                          <span className={`size-2 shrink-0 rounded-full ${
                            defect.severity === 'critical' ? 'bg-red-500' :
                            defect.severity === 'high' ? 'bg-orange-500' :
                            defect.severity === 'medium' ? 'bg-blue-500' : 'bg-gray-500'
                          }`} />
                        )}
                        <span className="truncate">{defect.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Download link (bottom-right) */}
          <a
            href={photo.image_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('download')}
            className="absolute bottom-4 right-4 z-20 flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </a>

          {/* Comments panel */}
          {showComments && photo && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 z-30 flex h-full w-96 max-w-[90vw] flex-col border-l border-white/10 bg-black/80 backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-medium text-white/90">{t('comments')}</h3>
                <button
                  onClick={() => setShowComments(false)}
                  className="text-white/60 hover:text-white"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <CommentThread
                  projectId={photo.project_id}
                  entityType="photo"
                  entityId={photo.id}
                />
              </div>
            </div>
          )}

          {/* Delete (bottom-left) */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete()
              }}
              disabled={deleting === photo.id}
              aria-label={t('delete')}
              className="absolute bottom-4 left-4 z-20 flex size-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white focus:outline-none focus:ring-2 focus:ring-destructive disabled:opacity-50"
            >
              {deleting === photo.id ? (
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  getProjectSchemas,
  deleteSchema,
  getSchemaPins,
  placePhotoOnSchema,
  removePhotoFromSchema,
  getPhotos,
} from '@/lib/supabase/queries'
import type { SiteSchema, SchemaPinWithPhoto, Photo } from '@/types/database'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Map, Plus } from 'lucide-react'

type ViewState = 'list' | 'detail'

export default function SchemaPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('schemaPage')
  const ct = useTranslations('common')

  const [schemas, setSchemas] = useState<SiteSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>('list')
  const [selectedSchema, setSelectedSchema] = useState<SiteSchema | null>(null)
  const [pins, setPins] = useState<SchemaPinWithPhoto[]>([])
  const [pinsLoading, setPinsLoading] = useState(false)

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [schemaName, setSchemaName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pin placement state
  const [placingPin, setPlacingPin] = useState(false)
  const [pinCoords, setPinCoords] = useState<{ x: number; y: number } | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  // Pin viewing state
  const [selectedPin, setSelectedPin] = useState<SchemaPinWithPhoto | null>(null)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Fetch schemas ──
  const fetchSchemas = useCallback(async () => {
    try {
      const data = await getProjectSchemas(id)
      setSchemas(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    let ignore = false

    const run = async () => {
      try {
        const data = await getProjectSchemas(id)
        if (!ignore) setSchemas(data)
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load schemas')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void run()

    return () => { ignore = true }
  }, [id])

  // ── Fetch pins when schema selected ──
  const fetchPins = useCallback(async (schemaId: string) => {
    setPinsLoading(true)
    try {
      const data = await getSchemaPins(schemaId)
      setPins(data)
    } catch {
      // silently fail
    } finally {
      setPinsLoading(false)
    }
  }, [])

  // ── Open schema detail ──
  const openSchema = useCallback(
    async (schema: SiteSchema) => {
      setSelectedSchema(schema)
      setView('detail')
      setSelectedPin(null)
      setPlacingPin(false)
      setPinCoords(null)
      await fetchPins(schema.id)
    },
    [fetchPins],
  )

  // ── Back to list ──
  const backToList = useCallback(() => {
    setView('list')
    setSelectedSchema(null)
    setPins([])
    setSelectedPin(null)
    setPlacingPin(false)
    setPinCoords(null)
  }, [])

  // ── Upload handlers ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
    setUploadError(null)
    if (!schemaName) {
      setSchemaName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !schemaName.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('projectId', id)
      formData.append('name', schemaName.trim())
      const res = await fetch('/api/upload-schema', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Upload failed')
      }
      setShowUpload(false)
      setUploadFile(null)
      setUploadPreview(null)
      setSchemaName('')
      await fetchSchemas()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const cancelUpload = () => {
    setShowUpload(false)
    setUploadFile(null)
    setUploadPreview(null)
    setSchemaName('')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Delete schema ──
  const handleDelete = async (schemaId: string) => {
    try {
      await deleteSchema(schemaId)
      setSchemas((prev) => prev.filter((s) => s.id !== schemaId))
      setDeleteConfirm(null)
    } catch {
      // silently fail
    }
  }

  // ── Pin placement: click on image ──
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placingPin || !selectedSchema) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setPinCoords({ x, y })
      // Load photos for the picker
      getPhotos(id)
        .then(setPhotos)
        .catch(() => setPhotos([]))
      setShowPhotoPicker(true)
    },
    [placingPin, selectedSchema, id],
  )

  // ── Confirm pin placement ──
  const confirmPin = async (photoId: string) => {
    if (!selectedSchema || !pinCoords) return
    try {
      await placePhotoOnSchema({
        schemaId: selectedSchema.id,
        photoId,
        x: pinCoords.x,
        y: pinCoords.y,
      })
      setShowPhotoPicker(false)
      setPlacingPin(false)
      setPinCoords(null)
      await fetchPins(selectedSchema.id)
    } catch {
      // silently fail
    }
  }

  // ── Remove pin ──
  const handleRemovePin = async (pinId: string) => {
    try {
      await removePhotoFromSchema(pinId)
      setPins((prev) => prev.filter((p) => p.id !== pinId))
      setSelectedPin(null)
    } catch {
      // silently fail
    }
  }

  // ── Loading state ──
  if (loading) {
    return <LoadingBlock />
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorAlert>{error}</ErrorAlert>
        <Link
          href={`/projects/${id}`}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {ct('back')}
        </Link>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════
  if (view === 'detail' && selectedSchema) {
    return (
      <div className="mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={backToList}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('backToSchemas')}
        </button>

        {/* Header */}
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{selectedSchema.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('schemaPins', { count: pins.length })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPlacingPin((prev) => !prev)
                setSelectedPin(null)
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                placingPin
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('pinPhoto')}
            </button>
          </div>
        </div>

        {/* Placing pin hint */}
        {placingPin && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
            {t('pinPhotoDesc')}
          </div>
        )}

        {/* Schema image with pins */}
        <div className="relative mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div
            className="relative cursor-crosshair"
            onClick={handleImageClick}
          >
            <Image
              src={selectedSchema.image_url}
              alt={selectedSchema.name}
              width={1200}
              height={800}
              className="block w-full h-auto"
              draggable={false}
              priority
            />

            {/* Pin markers */}
            {pins.map((pin) => (
              <button
                key={pin.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPin(selectedPin?.id === pin.id ? null : pin)
                }}
                className="group absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <svg
                  className={`size-6 drop-shadow-md ${
                    selectedPin?.id === pin.id ? 'text-primary' : 'text-destructive'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </button>
            ))}

            {pinsLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <div className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Selected pin detail */}
        {selectedPin && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="flex gap-4">
              <div className="relative size-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image
                  src={selectedPin.photos?.image_url ?? ''}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                {selectedPin.photos?.note && (
                  <p className="text-sm text-foreground">{selectedPin.photos.note}</p>
                )}
                {selectedPin.photos?.taken_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(selectedPin.photos.taken_at).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={() => handleRemovePin(selectedPin.id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('removePin')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo picker modal */}
        <Dialog
          open={showPhotoPicker}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowPhotoPicker(false)
              setPinCoords(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('choosePhoto')}</DialogTitle>
            </DialogHeader>
            <div className="max-h-80 overflow-y-auto p-1">
              {photos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('noPhotos')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => confirmPin(photo.id)}
                      className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <Image
                        src={photo.image_url}
                        alt=""
                        fill
                        sizes="200px"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════

  return (
    <div className="mx-auto px-4 py-8">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button
            onClick={() => setShowUpload(true)}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            <Plus />
            {t('uploadSchema')}
          </button>
        }
      />

      {/* Empty state */}
      {schemas.length === 0 && (
        <EmptyState
          icon={Map}
          title={t('noSchemas')}
          description={t('noSchemasDesc')}
        />
      )}

      {/* Schema grid */}
      {schemas.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schemas.map((schema) => (
            <div
              key={schema.id}
              className="group relative overflow-hidden rounded-md border border-border bg-surface-raised shadow-elevation-1 transition-all duration-200 ease-apple-spring hover:-translate-y-0.5 hover:border-accent hover:shadow-elevation-2"
            >
              <button
                onClick={() => openSchema(schema)}
                className="block w-full text-left"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  <Image
                    src={schema.image_url}
                    alt={schema.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-foreground truncate">{schema.name}</h3>
                </div>
              </button>

              {/* Pin count badge */}
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-sm">
                <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                0
              </div>

              {/* Delete button */}
              <div className="absolute right-2 bottom-2">
                {deleteConfirm === schema.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(schema.id)
                      }}
                      className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      {ct('confirm')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(null)
                      }}
                      className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {ct('cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm(schema.id)
                    }}
                    className="rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    {t('deleteSchema')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Dialog
        open={showUpload}
        onOpenChange={(isOpen) => {
          if (!isOpen && !uploading) cancelUpload()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('uploadSchema')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Drop zone */}
            {!uploadFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <svg className="size-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-muted-foreground">{t('uploadSchemaSubtitle')}</p>
              </button>
            )}

            {/* Preview */}
            {uploadFile && uploadPreview && (
              <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border">
                <Image src={uploadPreview} alt={ct('previewAlt')} fill unoptimized className="object-contain" />
              </div>
            )}

            {/* Name field */}
            <div>
              <label htmlFor="schema-name" className="block text-sm font-medium text-foreground">
                {t('schemaNameLabel')}
              </label>
              <input
                id="schema-name"
                type="text"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                placeholder={t('schemaNamePlaceholder')}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                disabled={uploading}
              />
            </div>

            {/* Error */}
            {uploadError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {uploadError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !schemaName.trim()}
                className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {ct('saving')}
                  </span>
                ) : (
                  t('uploadSchema')
                )}
              </button>
              <button
                onClick={cancelUpload}
                disabled={uploading}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {ct('cancel')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

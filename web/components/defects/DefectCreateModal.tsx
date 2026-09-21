'use client'

import { useState } from 'react'
import { useLabels } from '@/hooks/useLabels'
import type { Label } from '@/hooks/useLabels'
import { LabelPicker } from '@/components/labels/LabelPicker'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { defectCreateSchema } from '@/lib/validation/schemas'
import type { DefectCreateInput } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DefectSeverity } from '@/types/database'

export function DefectCreateModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: { title: string; description?: string; severity?: DefectSeverity; location?: string; labelIds: string[] }) => void
}) {
  const t = useTranslations('defects')
  const [saving, setSaving] = useState(false)
  const { groups } = useLabels()
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const [prevOpen, setPrevOpen] = useState(open)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof defectCreateSchema>, unknown, z.output<typeof defectCreateSchema>>({
    resolver: zodResolver(defectCreateSchema),
    defaultValues: { title: '', description: '', severity: 'medium' },
  })

  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setSelectedLabels([])
      reset({ title: '', description: '', severity: 'medium' })
    }
  }

  if (!open) return null

  async function onSubmit(data: DefectCreateInput) {
    setSaving(true)
    try {
      await onSave({ title: data.title, description: data.description || undefined, severity: data.severity, labelIds: selectedLabels.map(l => l.id) })
      reset()
      setSelectedLabels([])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addDefect')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-3">
          <div>
            <label className="text-sm font-medium">{t('title')}</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              {...register('title')}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('description')}</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              {...register('description')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('severity')}</label>
            <select
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              {...register('severity')}
            >
              <option value="low">{t('low')}</option>
              <option value="medium">{t('medium')}</option>
              <option value="high">{t('high')}</option>
              <option value="critical">{t('critical')}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t('labels')}</label>
            <div className="mt-1">
              <LabelPicker groups={groups} selected={selectedLabels} onChange={setSelectedLabels} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createDailyLog } from '@/lib/supabase/queries'
import { dailyLogSchema } from '@/lib/validation/schemas'
import type { DailyLogInput } from '@/lib/validation/schemas'
import { useLabels } from '@/hooks/useLabels'
import type { Label } from '@/hooks/useLabels'
import { LabelPicker } from '@/components/labels/LabelPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { monitoring } from '@/lib/monitoring'

interface DailyLogFormProps {
  projectId: string
  onCreated: () => void
}

export default function DailyLogForm({ projectId, onCreated }: DailyLogFormProps) {
  const t = useTranslations('dailyLog')
  const [loading, setLoading] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const { groups } = useLabels()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof dailyLogSchema>, unknown, z.output<typeof dailyLogSchema>>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      logDate: new Date().toISOString().split('T')[0],
      weather: '',
      temperature: '',
      workDescription: '',
      notes: '',
    },
  })

  async function onSubmit(data: DailyLogInput) {
    setLoading(true)
    try {
      const log = await createDailyLog({
        project_id: projectId,
        log_date: data.logDate,
        weather: data.weather || null,
        temperature: data.temperature || null,
        work_description: data.workDescription,
        notes: data.notes || null,
      })

      for (const label of selectedLabels) {
        try {
          await fetch('/api/taggings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label_id: label.id,
              taggable_type: 'daily_log',
              taggable_id: log.id,
            }),
          })
        } catch (tagErr) {
          monitoring.captureException(tagErr, { extra: { component: 'DailyLogForm', action: 'saveTagging', projectId } })
        }
      }

      reset()
      setSelectedLabels([])
      onCreated()
    } catch (err) {
      monitoring.captureException(err, { extra: { component: 'DailyLogForm', action: 'createDailyLog', projectId } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t('date')}</label>
            <input
              type="date"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              {...register('logDate')}
            />
            {errors.logDate && (
              <p className="text-xs text-destructive">{errors.logDate.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{t('weather')}</label>
              <input
                type="text"
                placeholder={t('weatherPlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                {...register('weather')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('temperature')}</label>
              <input
                type="text"
                placeholder={t('temperaturePlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                {...register('temperature')}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('workDescription')}</label>
            <textarea
              placeholder={t('workDescriptionPlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              {...register('workDescription')}
            />
            {errors.workDescription && (
              <p className="text-xs text-destructive">{errors.workDescription.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('notes')}</label>
            <textarea
              placeholder={t('notesPlaceholder')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              {...register('notes')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('labels')}</label>
            <LabelPicker groups={groups} selected={selectedLabels} onChange={setSelectedLabels} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

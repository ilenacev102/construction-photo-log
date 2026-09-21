'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { workOrderCreateSchema } from '@/lib/validation/schemas'
import type { WorkOrderCreateInput } from '@/lib/validation/schemas'
import type { WorkOrderPriority, Profile, Project, WorkOrder } from '@/types/database'

function fromWorkOrder(wo: WorkOrder): WorkOrderCreateInput {
  return {
    title: wo.title,
    description: wo.description ?? '',
    location: wo.location ?? '',
    assigned_to: wo.assigned_to ?? '',
    priority: wo.priority,
    due_date: wo.due_date ?? '',
  }
}

export interface WorkOrderCreateFormProps {
  projects: Project[]
  team: Profile[]
  initial?: WorkOrder
  defaultProjectId?: string
  submitLabel: string
  onSubmit: (input: {
    project_id: string
    title: string
    description?: string
    location?: string
    assigned_to?: string
    priority?: WorkOrderPriority
    due_date?: string
  }) => Promise<void>
  onCancel: () => void
}

export function WorkOrderCreateForm({
  projects,
  team,
  initial,
  defaultProjectId,
  submitLabel,
  onSubmit,
  onCancel,
}: WorkOrderCreateFormProps) {
  const t = useTranslations('workOrders')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof workOrderCreateSchema>, unknown, z.output<typeof workOrderCreateSchema>>({
    resolver: zodResolver(workOrderCreateSchema),
    defaultValues: initial ? fromWorkOrder(initial) : {
      title: '',
      description: '',
      location: '',
      assigned_to: '',
      priority: 'medium',
      due_date: '',
    },
  })

  const handleFormSubmit = async (values: WorkOrderCreateInput) => {
    setSubmitting(true)
    try {
      await onSubmit({
        project_id: defaultProjectId ?? projects[0]?.id ?? '',
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        location: values.location.trim() || undefined,
        assigned_to: values.assigned_to || undefined,
        priority: values.priority,
        due_date: values.due_date || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="wo-title" className="text-sm font-medium">
          {t('titleLabel')}
        </label>
        <input
          id="wo-title"
          type="text"
          className={inputClass}
          {...register('title')}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="wo-description" className="text-sm font-medium">
          {t('descriptionLabel')}
        </label>
        <textarea
          id="wo-description"
          rows={3}
          className={cn(inputClass, 'resize-y')}
          {...register('description')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wo-location" className="text-sm font-medium">
            {t('locationLabel')}
          </label>
          <input
            id="wo-location"
            type="text"
            className={inputClass}
            {...register('location')}
          />
        </div>

        <div>
          <label htmlFor="wo-assignee" className="text-sm font-medium">
            {t('assigneeLabel')}
          </label>
          <select
            id="wo-assignee"
            className={inputClass}
            {...register('assigned_to')}
          >
            <option value="">—</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wo-priority" className="text-sm font-medium">
            {t('priorityLabel')}
          </label>
          <select
            id="wo-priority"
            className={inputClass}
            {...register('priority')}
          >
            {(['low', 'medium', 'high'] as WorkOrderPriority[]).map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wo-due" className="text-sm font-medium">
            {t('dueDateLabel')}
          </label>
          <input
            id="wo-due"
            type="date"
            className={inputClass}
            {...register('due_date')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

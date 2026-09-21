'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { commentSchema } from '@/lib/validation/schemas'
import type { CommentInput } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'

interface CommentFormProps {
  projectId: string
  entityType: string
  entityId: string
  parentId?: string
  onSubmit?: () => void
  onCancel?: () => void
}

export function CommentForm({
  projectId,
  entityType,
  entityId,
  parentId,
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '' },
  })

  const handleFormSubmit = async ({ body }: CommentInput) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          body: body.trim(),
          parentId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to post comment')
      }

      reset()
      onSubmit?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-2">
      <textarea
        placeholder={parentId ? 'Напиши одговор...' : 'Напиши коментар... (@ за спомнување)'}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none"
        disabled={isSubmitting}
        {...register('body')}
      />
      {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Откажи
          </Button>
        )}
        <Button type="submit" variant="default" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Се испраќа...' : parentId ? 'Одговори' : 'Коментирај'}
        </Button>
      </div>
    </form>
  )
}

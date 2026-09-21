'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createProject } from '@/lib/supabase/queries'
import { newProjectSchema } from '@/lib/validation/schemas'
import type { NewProjectInput } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Link } from '@/i18n/navigation'
import BackButton from '@/components/BackButton'

export default function NewProjectPage() {
  const t = useTranslations('newProject')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof newProjectSchema>, unknown, z.output<typeof newProjectSchema>>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: '', address: '', clientName: '' },
  })

  async function onSubmit(data: NewProjectInput) {
    setError(null)
    setLoading(true)

    try {
      await createProject(
        data.name.trim(),
        data.address.trim() || undefined,
        data.clientName.trim() || undefined
      )
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 animate-fade-in-up">
      {/* Back link */}
      <BackButton href="/dashboard" label={t('back')} />

      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-5">
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            {t('nameLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            placeholder={t('namePlaceholder')}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">
            {t('addressLabel')}
          </Label>
          <Input
            id="address"
            type="text"
            placeholder={t('addressPlaceholder')}
            {...register('address')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client">
            {t('clientLabel')}
          </Label>
          <Input
            id="client"
            type="text"
            placeholder={t('clientPlaceholder')}
            {...register('clientName')}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? t('submitting') : t('submit')}
          </Button>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}

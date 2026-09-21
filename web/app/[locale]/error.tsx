'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { monitoring } from '@/lib/monitoring'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')

  useEffect(() => {
    monitoring.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {t('description')}
      </p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  )
}

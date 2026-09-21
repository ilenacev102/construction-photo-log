import { getTranslations } from 'next-intl/server'

export default async function Loading() {
  const t = await getTranslations('common')

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  )
}

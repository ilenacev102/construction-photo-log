import { ShieldAlert } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function PendingAccessPage() {
  const t = await getTranslations('pendingAccess')

  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-xl place-items-center px-4 py-12 text-center">
      <div className="rounded-xl border border-border-strong bg-surface-raised p-8 shadow-elevation-2">
        <span className="mx-auto grid size-11 place-items-center rounded-xs border border-accent/30 bg-accent-muted/40 text-accent"><ShieldAlert className="size-5" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('overline')}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('description')}</p>
        <Link href="/" className="mt-6 inline-flex rounded-xs border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-sunken">{t('backToSite')}</Link>
      </div>
    </div>
  )
}

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function CTASection() {
  const t = useTranslations()

  return (
    <section className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground">
      {/* Subtle accent glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />

      <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t('cta.title')}
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/90">
          {t('cta.subtitle')}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'border-primary-foreground/20 bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground/90',
            )}
          >
            {t('cta.button')}
          </Link>
          <Link
            href="/case-studies"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'lg' }),
              'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground',
            )}
          >
            {t('roleDashboard.viewAllProjects')}
          </Link>
        </div>
      </div>
    </section>
  )
}
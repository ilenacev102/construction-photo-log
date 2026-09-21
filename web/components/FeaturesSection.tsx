import { useTranslations } from 'next-intl'
import { Camera, MapPin, FileText, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Feature = {
  icon: LucideIcon
  title: string
  desc: string
  className?: string
  iconClassName?: string
  tall?: boolean
}

export default function FeaturesSection() {
  const t = useTranslations('features')

  const features: Feature[] = [
    {
      icon: Camera,
      title: t('autoDate.title'),
      desc: t('autoDate.desc'),
      className: 'sm:row-span-2',
      iconClassName: 'size-12 rounded-2xl bg-accent text-background',
      tall: true,
    },
    {
      icon: MapPin,
      title: t('gps.title'),
      desc: t('gps.desc'),
      iconClassName: 'size-10 rounded-full border border-accent/30 text-accent',
    },
    {
      icon: FileText,
      title: t('pdf.title'),
      desc: t('pdf.desc'),
      iconClassName: 'size-10 rounded-lg bg-accent/10 text-accent',
    },
    {
      icon: Users,
      title: t('team.title'),
      desc: t('team.desc'),
      className: 'sm:col-span-2',
      iconClassName: 'size-10 rounded-xl bg-accent-muted/40 text-accent',
    },
  ]

  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
            {t('title')}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('subtitle')}
          </h2>
        </div>

        {/* Bento grid */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, className, iconClassName, tall }) => (
            <div
              key={title}
              className={cn(
                'min-w-0 group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 sm:p-7',
                className,
              )}
            >
              {tall && (
                <Icon
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-6 -right-6 size-24 text-accent/10"
                />
              )}
              <span
                className={cn(
                  'grid place-items-center transition-transform duration-200 ease-premium group-hover:scale-105',
                  iconClassName ?? 'size-11 rounded-xl bg-accent/10 text-accent',
                )}
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
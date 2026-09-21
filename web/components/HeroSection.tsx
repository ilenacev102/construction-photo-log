import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { ArrowRight, Camera, MapPin, FileText, CheckCircle2, ShieldCheck, Crosshair, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function HeroSection() {
  const t = useTranslations()

  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      {/* Precision CAD Blueprint Grid Overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.13_0.02_260/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.13_0.02_260/0.03)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)]"
      />

      <div className="relative mx-auto flex min-h-[80dvh] max-w-6xl flex-col justify-center px-4 pb-20 pt-12 sm:px-6 sm:pb-28 sm:pt-16">
        {/* Top Tagline Pill */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-pill border border-accent/30 bg-accent-muted/40 px-3.5 py-1 text-xs font-semibold tracking-wider text-accent uppercase backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
            {t('hero.tagline')}
          </div>

          <h1 className="mt-6 animate-fade-in-up text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl text-balance" style={{ animationDelay: '120ms' }}>
            {t('hero.line1')} <br className="hidden sm:block" />
            <span className="text-accent">{t('hero.line2')}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl animate-fade-in-up text-base leading-relaxed text-muted-foreground sm:text-lg text-pretty" style={{ animationDelay: '220ms' }}>
            {t('hero.description')}
          </p>

          <div className="mt-9 flex animate-fade-in-up flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '320ms' }}>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: 'cta', size: 'lg' }),
                'group shadow-elevation-2',
              )}
            >
              {t('hero.ctaStart')}
              <ArrowRight className="size-4 transition-transform duration-200 ease-apple-spring group-hover:translate-x-1" />
            </Link>
            <Link
              href="/case-studies"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
              )}
            >
              {t('roleDashboard.viewAllProjects')}
            </Link>
          </div>
        </div>

        {/* Architectural Field Viewfinder Showcase */}
        <div className="relative mx-auto mt-14 max-w-5xl animate-fade-in-up sm:mt-20" style={{ animationDelay: '450ms' }}>
          <div className="relative rounded-lg border border-border-strong bg-surface-raised p-4 shadow-elevation-3 sm:p-6">
            {/* Viewfinder Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-sm border border-accent/30 bg-accent-muted/30 text-accent">
                  <Crosshair className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      FIELD SECTOR 4A · PROGRESS LOG
                    </span>
                    <span className="rounded-xs bg-success/15 px-2 py-0.5 font-mono text-[11px] font-medium text-success">
                      ACTIVE VERIFIED
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    LAT 37.7749° N · LON -122.4194° W · ALT 42m
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-sunken px-3 py-1.5 font-mono text-xs text-foreground">
                  <ShieldCheck className="size-3.5 text-success" />
                  EXIF TAMPER-PROOF
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-sunken px-3 py-1.5 font-mono text-xs text-foreground">
                  <FileText className="size-3.5 text-accent" />
                  PDF AUTO-GENERATED
                </span>
              </div>
            </div>

            {/* Photo Telemetry Cards Grid */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { title: 'Foundation Rebar Installation', date: '2026-08-06 08:30:14', EXIF: 'f/2.8 · 1/500s · ISO 100', status: 'Approved' },
                { title: 'Structural Steel Framing Level 3', date: '2026-08-06 10:15:42', EXIF: 'f/1.8 · 1/1000s · ISO 50', status: 'Pending Review' },
                { title: 'Concrete Pour Density Check', date: '2026-08-06 14:02:11', EXIF: 'f/4.0 · 1/250s · ISO 200', status: 'Approved' },
              ].map((item, idx) => (
                <div key={idx} className="group relative animate-fade-in-up rounded-sm border border-border bg-surface-sunken p-3.5 transition-all duration-200 ease-apple-spring hover:border-accent hover:shadow-elevation-2" style={{ animationDelay: `${580 + idx * 120}ms` }}>
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xs border border-border/80 bg-background">
                    <div className="absolute inset-0 grid place-items-center bg-surface-sunken/60">
                      <Camera className="size-7 text-muted-foreground/50 transition-transform duration-200 group-hover:scale-110 group-hover:text-accent" />
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-xs bg-background/90 px-2 py-0.5 font-mono text-[10px] font-medium text-foreground backdrop-blur-sm">
                      <MapPin className="size-2.5 text-accent" />
                      PIN #{idx + 101}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</h4>
                      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.date}</p>
                    <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-tertiary-foreground font-mono">
                      <span>{item.EXIF}</span>
                      <span className="text-accent font-semibold">{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Status Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between border-t border-border pt-4 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3.5 text-accent" />
                  3 ACTIVE SITES LOGGED
                </span>
                <span>·</span>
                <span>2,480 HIGH-RES PHOTOS</span>
              </div>
              <span className="text-accent font-semibold">SYNC STATUS: 100% OFFLINE-READY</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


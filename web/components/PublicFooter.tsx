import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Camera } from 'lucide-react'

/**
 * Localized marketing footer for all public routes.
 * Rendered by <PublicSiteShell /> — never shown on app routes.
 */
// Mirrors the per-locale CONTENT map in app/[locale]/case-studies/page.tsx —
// case-study strings intentionally stay out of web/messages/*.json.
const CASE_STUDIES_TITLE: Record<string, string> = {
  en: 'Case Studies',
  mk: 'Студии на случај',
  sl: 'Študije primerov',
  sr: 'Studije slučaja',
  de: 'Fallstudien',
}

export default function PublicFooter() {
  const t = useTranslations()
  const locale = useLocale()

  const productLinks = [
    { href: '/case-studies' as const, label: CASE_STUDIES_TITLE[locale] ?? 'Case Studies' },
    { href: '/blog' as const, label: t('blog.title') },
  ]

  const accountLinks = [
    { href: '/login' as const, label: t('common.loginButton') },
    { href: '/signup' as const, label: t('hero.ctaStart') },
  ]

  const legalLinks = [
    { href: '/privacy' as const, label: 'Privacy Policy' },
    { href: '/terms' as const, label: 'Terms of Service' },
    { href: '/security' as const, label: 'Security' },
    { href: '/cookies' as const, label: 'Cookie Policy' },
  ]

  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 xl:max-w-7xl 3xl:max-w-[100rem]">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/10">
                <Camera className="size-[18px] text-accent" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                {t('navbar.appName')}
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t('hero.tagline')}
            </p>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h3>
              <ul className="mt-3 space-y-2">
                {productLinks.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Account</h3>
              <ul className="mt-3 space-y-2">
                {accountLinks.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Trust & Legal</h3>
              <ul className="mt-3 space-y-2">
                {legalLinks.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {t('navbar.appName')}
          </span>
          <span>{t('common.allRightsReserved')}</span>
        </div>
      </div>
    </footer>
  )
}

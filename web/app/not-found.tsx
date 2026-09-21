import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Camera } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

/**
 * Helpful links for the 404 page. Lives here (not in web/messages/*.json)
 * because the i18n edit rule forbids adding keys — the labels are only ever
 * shown as static chrome on this page.
 */
const HELPFUL_LINKS: Record<string, { label: string; href: string }[]> = {
  en: [
    { label: 'Blog', href: '/blog' },
    { label: 'Features', href: '/#features' },
    { label: 'Log in', href: '/login' },
  ],
  mk: [
    { label: 'Блог', href: '/blog' },
    { label: 'Функции', href: '/#features' },
    { label: 'Најава', href: '/login' },
  ],
  sl: [
    { label: 'Blog', href: '/blog' },
    { label: 'Funkcije', href: '/#features' },
    { label: 'Prijava', href: '/login' },
  ],
  sr: [
    { label: 'Blog', href: '/blog' },
    { label: 'Funkcije', href: '/#features' },
    { label: 'Prijava', href: '/login' },
  ],
  de: [
    { label: 'Blog', href: '/blog' },
    { label: 'Funktionen', href: '/#features' },
    { label: 'Anmelden', href: '/login' },
  ],
}

export default async function NotFound() {
  const t = await getTranslations('notFoundPage')
  const navbar = await getTranslations('navbar')
  const locale = await getLocale()
  const links = HELPFUL_LINKS[locale] ?? HELPFUL_LINKS.en

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Link href="/" className="group flex shrink-0 items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-xs border border-accent/30 bg-accent-muted/40 text-accent transition-transform duration-200 ease-apple-spring group-hover:scale-105">
          <Camera className="size-4 text-accent" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {navbar('appName')}
        </span>
      </Link>
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('description')}</p>
      <Link href="/" className={buttonVariants({ variant: 'default' })}>
        {t('backHome')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={buttonVariants({ variant: 'outline' })}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
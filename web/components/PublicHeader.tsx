'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Camera, Menu, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Localized marketing header for all public routes.
 * Rendered by <PublicSiteShell /> — never shown on app routes.
 */
export default function PublicHeader() {
  const t = useTranslations()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  const navItems = [
    { href: '/blog' as const, label: t('blog.title') },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <header className="sticky top-3 z-50 mx-auto max-w-6xl px-4 sm:px-6 xl:max-w-7xl 3xl:max-w-[100rem]">
      <div className="flex h-15 items-center justify-between gap-4 rounded-md border border-border-strong bg-surface-raised/90 px-4 shadow-elevation-2 backdrop-blur-lg transition-all duration-200 ease-apple-spring sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          onClick={closeMenu}
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="grid size-8 place-items-center rounded-xs border border-accent/30 bg-accent-muted/40 text-accent transition-transform duration-200 ease-apple-spring group-hover:scale-105">
            <Camera className="size-4 text-accent" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {t('navbar.appName')}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'relative rounded-xs px-3.5 py-1.5 text-xs font-semibold transition-all duration-180 ease-apple-spring',
                isActive(href)
                  ? 'bg-accent-muted/40 text-accent font-semibold'
                  : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right actions (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('common.loginButton')}
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: 'cta', size: 'sm' }), 'group gap-1.5')}
          >
            {t('hero.ctaStart')}
            <ArrowRight className="size-3.5 transition-transform duration-200 ease-apple-spring group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t('common.close') : t('common.openMenu')}
          className="grid size-8 place-items-center rounded-xs text-muted-foreground transition-colors duration-180 ease-apple-spring hover:bg-surface-sunken hover:text-foreground md:hidden"
        >
          {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Mobile panel */}
      {menuOpen && (
        <div className="mt-2 rounded-md border border-border-strong bg-surface-raised/95 px-4 pb-5 pt-3 shadow-elevation-3 backdrop-blur-lg md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Main">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                className={cn(
                  'rounded-xs px-3 py-2 text-sm font-medium transition-colors duration-180 ease-apple-spring',
                  isActive(href)
                    ? 'bg-accent-muted/40 text-accent font-semibold'
                    : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                onClick={closeMenu}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('common.loginButton')}
              </Link>
              <Link
                href="/signup"
                onClick={closeMenu}
                className={cn(buttonVariants({ variant: 'cta', size: 'sm' }), 'gap-1.5')}
              >
                {t('hero.ctaStart')}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { Camera, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  userEmail: string
}

export default function Navbar({ userEmail }: NavbarProps) {
  const t = useTranslations('navbar')
  const router = useRouter()
  const pathname = usePathname()
  const { role, isLoading: roleLoading, isManager } = useRole()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleLabel =
    role === 'site_manager' ? t('manager') : role === 'admin' ? t('admin') : role

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), show: true },
    { href: '/projects', label: t('projects'), show: true },
    { href: '/work-orders', label: t('workOrders'), show: role !== 'client' },
    { href: '/dashboard/manager', label: t('viewManager'), show: role === 'admin' },
    { href: '/dashboard/worker', label: t('viewField'), show: role === 'admin' },
    { href: '/admin/team', label: t('team'), show: isManager },
    { href: '/admin', label: t('admin'), show: role === 'admin' },
  ].filter((item) => item.show)

  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/dashboard' && pathname.startsWith(`${href}/`))

  const roleBadge = !roleLoading && role && role !== 'client' && (
    <span className="rounded-xs bg-accent-muted/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
      {roleLabel}
    </span>
  )

  return (
    <nav className="sticky top-3 z-50 mx-auto max-w-6xl px-4 sm:px-6 xl:max-w-7xl 3xl:max-w-[100rem]">
      <div className="flex h-15 items-center justify-between gap-4 rounded-md border border-border-strong bg-surface-raised/90 px-4 shadow-elevation-2 backdrop-blur-lg transition-all duration-200 ease-apple-spring sm:px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          onClick={closeMenu}
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="grid size-8 place-items-center rounded-xs border border-accent/30 bg-accent-muted/40 text-accent transition-transform duration-200 ease-apple-spring group-hover:scale-105">
            <Camera className="size-4 text-accent" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {t('appName')}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Main">
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
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <NotificationDropdown />
          <LanguageSwitcher />
          <span className="max-w-40 truncate text-sm text-muted-foreground">
            {userEmail}
          </span>
          {roleBadge}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            {t('logout')}
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t('menuClose') : t('menuOpen')}
          className="grid size-8 place-items-center rounded-xs text-muted-foreground transition-colors duration-180 ease-apple-spring hover:bg-surface-sunken hover:text-foreground md:hidden"
        >
          {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Mobile panel */}
      {menuOpen && (
        <div className="mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-md border border-border-strong bg-surface-raised/95 px-4 pb-5 pt-3 shadow-elevation-3 backdrop-blur-lg md:hidden">
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="max-w-40 truncate text-sm text-muted-foreground">
                {userEmail}
              </span>
              {roleBadge}
            </div>
            <div className="flex items-center gap-2">
              <NotificationDropdown />
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" />
                {t('logout')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

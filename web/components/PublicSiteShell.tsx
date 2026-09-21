'use client'

import { usePathname } from '@/i18n/navigation'
import PublicHeader from './PublicHeader'
import PublicFooter from './PublicFooter'

/**
 * Wraps all public locale routes with the marketing header + footer.
 * App routes (which already render their own <Navbar />) are passed
 * through untouched so they never see the public chrome.
 */
const APP_ROUTE_PREFIXES = ['/dashboard', '/projects', '/admin']

function isAppRoute(pathname: string) {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export default function PublicSiteShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (isAppRoute(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  )
}

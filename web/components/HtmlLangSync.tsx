'use client'

import { useEffect } from 'react'
import { routing } from '@/i18n/routing'

/**
 * Client-only sync of the <html lang> attribute.
 *
 * The root layout must stay free of `await cookies()` so every route can be
 * statically rendered (a cookies() read in the root layout forces 100% dynamic
 * rendering of the whole tree). Instead of blocking on the server, this
 * component reads the NEXT_LOCALE cookie that the next-intl middleware
 * (web/proxy.ts) set, and updates document.documentElement.lang after
 * hydration. suppressHydrationWarning on <html> covers the brief mismatch.
 */
export function HtmlLangSync() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
    const locale = match?.[1]
    if (locale && routing.locales.some((l) => l === locale)) {
      document.documentElement.lang = locale
    }
  }, [])

  return null
}

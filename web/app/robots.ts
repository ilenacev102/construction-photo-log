import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const appPaths = ['/admin', '/dashboard', '/projects', '/api']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Prefix matching is literal: '/admin' does not cover '/mk/admin',
        // so every locale needs its own entries.
        disallow: [
          ...appPaths,
          ...routing.locales.flatMap((locale) => appPaths.map((p) => `/${locale}${p}`)),
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

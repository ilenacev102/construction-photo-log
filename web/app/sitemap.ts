import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { getPathname } from '@/i18n/navigation'
import { getAllPosts } from '@/lib/blog'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const staticPaths = [
  '/',
  '/blog',
  '/case-studies',
  '/privacy',
  '/terms',
  '/security',
  '/cookies',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []
  const posts = getAllPosts()

  for (const locale of routing.locales) {
    for (const path of staticPaths) {
      entries.push({
        url: `${baseUrl}${getPathname({ href: path, locale })}`,
        lastModified: new Date(),
        changeFrequency: path === '/' ? 'daily' : 'weekly',
        priority: path === '/' ? 1 : 0.8,
      })
    }
    for (const post of posts) {
      entries.push({
        url: `${baseUrl}${getPathname({ href: `/blog/${post.slug}`, locale })}`,
        lastModified: post.date ? new Date(post.date) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }
  }

  return entries
}

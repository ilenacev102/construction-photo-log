import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import PublicSiteShell from '@/components/PublicSiteShell'
import { AriaStatusProvider } from '@/components/AriaStatusAnnouncer'
import { UserProvider } from '@/contexts/UserContext'
import { routing } from '@/i18n/routing'
import { getPathname } from '@/i18n/navigation'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://constructionphotolog.com'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  const languages: Record<string, string> = {}
  for (const loc of routing.locales) {
    languages[loc] = `${baseUrl}${getPathname({ href: '/', locale: loc })}`
  }
  languages['x-default'] = `${baseUrl}/en`

  return {
    title: t('homeTitle'),
    description: t('homeDesc'),
    alternates: {
      canonical: `${baseUrl}${getPathname({ href: '/', locale })}`,
      languages,
    },
    openGraph: {
      type: 'website',
      locale,
      url: `${baseUrl}${getPathname({ href: '/', locale })}`,
      title: t('homeTitle'),
      description: t('homeDesc'),
      siteName: t('siteName'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
      description: t('homeDesc'),
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()
  const t = await getTranslations({ locale, namespace: 'metadata' })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${baseUrl}/#software`,
        name: t('siteName'),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'EUR',
          lowPrice: '0',
          highPrice: '149',
          offerCount: '3',
        },
        featureList: [
          'GPS-stamped construction photo capture',
          'Architectural blueprint pin mapping',
          'Punch list defect management and aging',
          'Automated daily log generation',
          'One-click PDF field progress reports',
        ],
      },
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: t('siteName'),
        url: baseUrl,
        logo: `${baseUrl}/favicon.ico`,
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: t('siteName'),
      },
    ],
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <AriaStatusProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <UserProvider>
          <PublicSiteShell>{children}</PublicSiteShell>
        </UserProvider>
      </AriaStatusProvider>
    </NextIntlClientProvider>
  )
}

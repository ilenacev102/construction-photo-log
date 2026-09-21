'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition } from 'react'

export default function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchLanguage(nextLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  const locales = [
    { code: 'de', label: t('de') },
    { code: 'en', label: t('en') },
    { code: 'mk', label: t('mk') },
    { code: 'sl', label: t('sl') },
    { code: 'sr', label: t('sr') },
  ]

  return (
    <select
      value={locale}
      onChange={(e) => switchLanguage(e.target.value)}
      disabled={isPending}
      className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      aria-label={t('label')}
    >
      {locales.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}

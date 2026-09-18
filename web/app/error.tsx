'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { createTranslator } from 'next-intl'
import { Button, buttonVariants } from '@/components/ui/button'
import { monitoring } from '@/lib/monitoring'

import de from '@/messages/de.json'
import en from '@/messages/en.json'
import mk from '@/messages/mk.json'
import sl from '@/messages/sl.json'
import sr from '@/messages/sr.json'

const messagesByLocale = { de, en, mk, sl, sr } as const
type Locale = keyof typeof messagesByLocale
const fallbackLocale: Locale = 'mk'

export default function Error({
  error,
  reset,
}: {
  error?: Error & { digest?: string }
  reset: () => void
}) {
  // The root error boundary renders outside the NextIntlClientProvider in
  // [locale]/layout.tsx, so resolve the locale from the <html lang> attribute
  // set by the root layout (NEXT_LOCALE cookie) instead of using useTranslations.
  const [locale, setLocale] = useState<Locale>(fallbackLocale)

  useEffect(() => {
    if (error) {
      monitoring.captureException(error)
    }
  }, [error])

  useEffect(() => {
    const lang = document.documentElement.lang
    if (lang in messagesByLocale) {
      // One-time DOM read after mount: initial state 'mk' matches the server
      // render (document is unavailable during SSR), so there is no hydration
      // mismatch. This is a true external-system sync, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(lang as Locale)
    }
  }, [])

  const t = useMemo(
    () => createTranslator({ locale, messages: messagesByLocale[locale] }),
    [locale],
  )

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center text-destructive">
          <TriangleAlert className="size-12" />
        </div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">
          {t('errorPage.title')}
        </h1>
        <p className="mb-8 text-muted-foreground text-sm">
          {t('errorPage.description')}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={reset}>{t('errorPage.retry')}</Button>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            {t('errorPage.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}

import { Link, redirect } from '@/i18n/navigation'
import { type Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import AuthForm from '@/components/AuthForm'
import { createClient } from '@/lib/supabase/server'
import { Camera } from 'lucide-react'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  return {
    title: t('loginTitle'),
  }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect({ href: '/dashboard', locale })

  const t = await getTranslations('auth')

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Camera className="size-5 text-accent" />
          <h1 className="text-xl font-semibold tracking-tight">{t('login')}</h1>
        </div>
        <AuthForm mode="login" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link
            href="/signup"
            className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            {t('signupLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}

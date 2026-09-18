'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import AttendancePanel from '@/components/AttendancePanel'
import { createClient } from '@/lib/supabase/client'

// QR codes embed the project id as a query param, so the scanned link is only
// trusted after validating it against the canonical UUID format.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function CheckinContent() {
  const t = useTranslations('checkin')
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')

  useEffect(() => {
    let ignore = false
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!ignore) setAuthState(user ? 'authenticated' : 'anonymous')
    }
    void run()
    return () => { ignore = true }
  }, [])

  if (!projectId || !UUID_PATTERN.test(projectId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('invalidLink')}</p>
        </CardContent>
      </Card>
    )
  }

  if (authState === 'loading') {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-4 border-border border-t-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (authState === 'anonymous') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{t('notAuthenticated')}</p>
          <Button onClick={() => router.push('/login')}>{t('login')}</Button>
        </CardContent>
      </Card>
    )
  }

  return <AttendancePanel projectId={projectId} />
}

export default function CheckinPage() {
  const t = useTranslations('checkin')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {/* useSearchParams requires a Suspense boundary during prerendering */}
      <div className="mt-8">
        <Suspense fallback={null}>
          <CheckinContent />
        </Suspense>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { getPathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAttendance } from '@/hooks/useAttendance'
import { useRole } from '@/hooks/useRole'
import { DEFAULT_TZ } from '@/lib/time'
import { monitoring } from '@/lib/monitoring'

interface AttendancePanelProps {
  projectId: string
  tz?: string
}

export default function AttendancePanel({ projectId, tz = DEFAULT_TZ }: AttendancePanelProps) {
  const t = useTranslations('attendance')
  const { todayLog, logs, isLoading, checkIn, checkOut } = useAttendance(projectId, tz)
  const { isManager } = useRole()
  const [checkingIn, setCheckingIn] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const locale = useLocale()

  useEffect(() => {
    if (!showQR || !isManager) return
    let ignore = false
    // Same generation flow as ProjectQRCode: encode an absolute URL to the
    // check-in landing page so a phone camera scan opens /checkin directly.
    const run = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const target = `${window.location.origin}${getPathname({ href: '/checkin', locale })}?projectId=${projectId}`
        const dataUrl = await QRCode.toDataURL(target, { width: 256, margin: 1 })
        if (!ignore) setQrDataUrl(dataUrl)
      } catch (err) {
        monitoring.captureException(err, { extra: { component: 'AttendancePanel', action: 'generateQR', projectId } })
      }
    }
    void run()
    return () => { ignore = true }
  }, [showQR, isManager, projectId, locale])

  async function handleCheckIn() {
    setCheckingIn(true)
    try {
      await checkIn()
    } catch (err) {
      monitoring.captureException(err, { extra: { component: 'AttendancePanel', action: 'checkIn', projectId } })
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleCheckOut() {
    setCheckingIn(true)
    try {
      await checkOut()
    } catch (err) {
      monitoring.captureException(err, { extra: { component: 'AttendancePanel', action: 'checkOut', projectId } })
    } finally {
      setCheckingIn(false)
    }
  }

  function formatDuration(minutes: number | null): string {
    if (!minutes) return '--'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-4 border-border border-t-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        {isManager && (
          <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
            {showQR ? t('hideQR') : t('showQR')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Check-in/out status */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
          {todayLog?.check_in && !todayLog.check_out ? (
            <>
              <p className="text-sm text-muted-foreground">{t('checkedInSince')}</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatDuration(todayLog.duration_minutes)}
              </p>
              <Button
                onClick={handleCheckOut}
                disabled={checkingIn}
                variant="destructive"
                className="mt-3"
              >
                {checkingIn ? t('processing') : t('checkOut')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('notCheckedIn')}</p>
              <Button onClick={handleCheckIn} disabled={checkingIn} className="mt-3">
                {checkingIn ? t('processing') : t('checkIn')}
              </Button>
            </>
          )}
        </div>

        {/* QR Code display for managers */}
        {showQR && isManager && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="mb-2 text-sm font-medium">{t('qrTitle')}</p>
            {qrDataUrl ? (
              <Image
                unoptimized
                src={qrDataUrl}
                alt={t('qrTitle')}
                width={192}
                height={192}
                className="mx-auto size-48 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="mx-auto flex size-48 items-center justify-center rounded-lg bg-white">
                <div className="size-6 animate-spin rounded-full border-4 border-border border-t-foreground" />
              </div>
            )}
          </div>
        )}

        {/* Recent logs */}
        {logs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('recentLogs')}</h3>
            <div className="space-y-1.5">
              {logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {new Date(log.check_in).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">
                    {log.check_out
                      ? formatDuration(log.duration_minutes)
                      : t('active')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

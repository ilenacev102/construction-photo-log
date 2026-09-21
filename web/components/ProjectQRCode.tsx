'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import QRCode from 'qrcode'
import { Check, Copy, Download, Loader2, QrCode } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProjectQRCodeProps {
  projectId: string
  projectName?: string
  variant?: 'card' | 'button'
}

type QrState =
  | { status: 'loading' }
  | { status: 'ready'; dataUrl: string; url: string }
  | { status: 'error' }

const QR_SIZE = 240
const COPY_RESET_MS = 2000

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy fallback below.
    }
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function ProjectQRCode({
  projectId,
  projectName,
  variant = 'card',
}: ProjectQRCodeProps) {
  const t = useTranslations('projectQR')
  const locale = useLocale()

  const [qr, setQr] = useState<QrState>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Render-time state adjustment (React's documented pattern) — resets the
  // QR to loading when the project or locale changes, avoiding an effect.
  const [prevQrKey, setPrevQrKey] = useState(`${projectId}|${locale}`)
  const qrKey = `${projectId}|${locale}`
  if (qrKey !== prevQrKey) {
    setPrevQrKey(qrKey)
    setQr({ status: 'loading' })
    setCopied(false)
  }

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const path = getPathname({
          href: `/projects/${projectId}`,
          locale: locale as Locale,
        })
        const url = `${window.location.origin}${path}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: QR_SIZE,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setQr({ status: 'ready', dataUrl, url })
        }
      } catch {
        if (!cancelled) {
          setQr({ status: 'error' })
        }
      }
    }

    generate()

    return () => {
      cancelled = true
      if (copyTimer.current !== undefined) {
        window.clearTimeout(copyTimer.current)
      }
    }
  }, [projectId, locale])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleCopy(url: string) {
    void copyTextToClipboard(url).then((ok) => {
      if (!ok) return
      setCopied(true)
      if (copyTimer.current !== undefined) {
        window.clearTimeout(copyTimer.current)
      }
      copyTimer.current = window.setTimeout(() => {
        setCopied(false)
      }, COPY_RESET_MS)
    })
  }

  function renderQrContent(imageClass: string) {
    if (qr.status === 'loading') {
      return (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground"
        >
          <Loader2 className="size-6 animate-spin" />
          <p className="text-xs">{t('loading')}</p>
        </div>
      )
    }

    if (qr.status === 'error') {
      return (
        <p className="py-8 text-center text-xs text-destructive">
          {t('error')}
        </p>
      )
    }

    return (
      <>
        <Image
          src={qr.dataUrl}
          alt={t('title')}
          width={QR_SIZE}
          height={QR_SIZE}
          unoptimized
          className={cn('rounded-lg border border-border', imageClass)}
        />
        <p
          title={qr.url}
          className="w-full truncate select-all rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
        >
          {qr.url}
        </p>
        <button
          type="button"
          onClick={() => handleCopy(qr.url)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t('copied') : t('copyLink')}
        </button>
      </>
    )
  }

  if (variant === 'button') {
    return (
      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('generate')}
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <QrCode className="size-4" />
        </button>
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('title')}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              {renderQrContent('size-52')}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="truncate">{projectName ?? t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {qr.status === 'ready' ? (
          <>
            <Image
              src={qr.dataUrl}
              alt={t('title')}
              width={QR_SIZE}
              height={QR_SIZE}
              unoptimized
              className="size-60 rounded-lg border border-border"
            />
            <p
              title={qr.url}
              className="w-full truncate select-all rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
            >
              {qr.url}
            </p>
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => handleCopy(qr.url)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? t('copied') : t('copyLink')}
              </button>
              <button
                type="button"
                onClick={() => downloadDataUrl(qr.dataUrl, `${projectId}-qr.png`)}
                className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'flex-1')}
              >
                <Download className="size-3.5" />
                {t('download')}
              </button>
            </div>
          </>
        ) : (
          renderQrContent('')
        )}
      </CardContent>
    </Card>
  )
}

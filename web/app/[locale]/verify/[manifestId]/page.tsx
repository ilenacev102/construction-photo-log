'use client'

import { use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface VerifyPhoto {
  id: string
  verdict: 'match' | 'mismatch' | 'unverifiable'
}

interface VerifyResult {
  manifest_id: string
  project_id: string
  created_at: string
  verdict: 'valid' | 'invalid'
  manifest_hash: string
  recomputed_hash: string
  photos: VerifyPhoto[]
  unverifiable: number
}

export default function VerifyPage({
  params,
}: {
  params: Promise<{ manifestId: string }>
}) {
  const { manifestId } = use(params)
  const t = useTranslations('verify')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/verify/${manifestId}`)
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((json) => setResult(json.data as VerifyResult))
      .catch(() => setError(true))
  }, [manifestId])

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-semibold">{t('notFound')}</h2>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  const valid = result.verdict === 'valid'

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-12">
      <div
        className={`rounded-md border px-6 py-4 text-center ${
          valid
            ? 'border-accent/30 bg-accent-muted/40 text-accent'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        }`}
      >
        <p className="text-lg font-bold">
          {valid ? t('validTitle') : t('invalidTitle')}
        </p>
        <p className="mt-1 text-xs font-medium">
          {valid ? t('validDesc') : t('invalidDesc')}
        </p>
      </div>
      <dl className="w-full space-y-2 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="font-semibold text-muted-foreground">{t('photosChecked')}</dt>
          <dd>{result.photos.length}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-semibold text-muted-foreground">{t('unverifiable')}</dt>
          <dd>{result.unverifiable}</dd>
        </div>
        <div className="flex justify-between gap-4 break-all">
          <dt className="font-semibold text-muted-foreground">{t('manifest')}</dt>
          <dd className="font-mono">{result.manifest_hash.slice(0, 16)}…</dd>
        </div>
      </dl>
      {result.photos.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('photoResults')}
          </p>
          <ul className="space-y-1.5">
            {result.photos.map((photo) => (
              <li
                key={photo.id}
                className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface-sunken px-3 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {photo.id.slice(0, 8)}…
                </span>
                <span
                  className={`rounded-xs px-2 py-0.5 text-[11px] font-semibold ${
                    photo.verdict === 'match'
                      ? 'bg-success/15 text-success'
                      : photo.verdict === 'mismatch'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-surface-raised text-muted-foreground'
                  }`}
                >
                  {photo.verdict === 'match'
                    ? t('matchLabel')
                    : photo.verdict === 'mismatch'
                      ? t('mismatchLabel')
                      : t('unverifiableLabel')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

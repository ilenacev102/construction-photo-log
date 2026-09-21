'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { deleteDailyLog } from '@/lib/supabase/queries'
import { LabelBadge } from '@/components/labels/LabelBadge'
import type { DailyLog } from '@/types/database'
import type { Label } from '@/hooks/useLabels'
import { monitoring } from '@/lib/monitoring'

interface DailyLogTimelineProps {
  dailyLogs: DailyLog[]
  logsLoading: boolean
  logsError: string | null
  refetchLogs: () => void
}

export default function DailyLogTimeline({ dailyLogs, logsLoading, refetchLogs }: DailyLogTimelineProps) {
  const t = useTranslations('dailyLog')
  const locale = useLocale()
  const [logLabels, setLogLabels] = useState<Record<string, Label[]>>({})

  useEffect(() => {
    async function fetchLabels() {
      if (dailyLogs.length === 0) {
        setLogLabels({})
        return
      }
      try {
        const ids = dailyLogs.map((l) => l.id).join(',')
        const res = await fetch(
          `/api/taggings?taggable_type=daily_log&taggable_ids=${encodeURIComponent(ids)}`,
          { credentials: 'include' },
        )
        const json = await res.json()
        const labelMap: Record<string, Label[]> = {}
        if (Array.isArray(json.data)) {
          for (const item of json.data) {
            if (item.taggable_id && item.labels) {
              if (!labelMap[item.taggable_id]) labelMap[item.taggable_id] = []
              labelMap[item.taggable_id].push(item.labels as Label)
            }
          }
        }
        setLogLabels(labelMap)
      } catch (err) {
        monitoring.captureException(err, { extra: { component: 'DailyLogTimeline' } })
      }
    }
    void fetchLabels()
  }, [dailyLogs])

  if (logsLoading) return <div className="text-sm text-muted-foreground">{t('loading')}</div>

  if (dailyLogs.length === 0) {
    return <div className="text-sm text-muted-foreground">{t('empty')}</div>
  }

  return (
    <div className="space-y-3">
      {dailyLogs.map((log) => (
        <div key={log.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {new Date(log.log_date).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              {log.weather && (
                <p className="text-xs text-muted-foreground">{t('weather')}: {log.weather}{log.temperature ? `, ${log.temperature}` : ''}</p>
              )}
            </div>
            <button
              onClick={() => deleteDailyLog(log.id).then(() => refetchLogs())}
              className="text-xs text-destructive hover:underline"
            >
              {t('delete')}
            </button>
          </div>
          <p className="mt-1 text-sm">{log.work_description}</p>
          {log.notes && <p className="mt-1 text-xs text-muted-foreground">{log.notes}</p>}
          {logLabels[log.id] && logLabels[log.id].length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {logLabels[log.id].map((label) => (
                <LabelBadge key={label.id} label={label} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

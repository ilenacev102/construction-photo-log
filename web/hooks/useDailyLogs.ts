'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDailyLogs } from '@/lib/supabase/queries'
import type { DailyLog } from '@/types/database'
import { monitoring } from '@/lib/monitoring'

export function useDailyLogs(projectId: string) {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDailyLogs(projectId)
      .then(data => {
        setLogs(data)
        setError(null)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load daily logs')
        monitoring.captureException(err, { extra: { hook: 'useDailyLogs', projectId } })
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const refetch = useCallback(() => {
    setLoading(true)
    getDailyLogs(projectId)
      .then(data => {
        setLogs(data)
        setError(null)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load daily logs')
        monitoring.captureException(err, { extra: { hook: 'useDailyLogs', projectId } })
      })
      .finally(() => setLoading(false))
  }, [projectId])

  return { logs, loading, error, refetch }
}

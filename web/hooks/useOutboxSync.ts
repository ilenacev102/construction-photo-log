'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ensureOutboxSyncStarted,
  getOutboxStore,
} from '@/lib/offline/store'
import type { DrainResult } from '@/lib/offline/sync'

export interface OutboxSyncState {
  pendingCount: number
  lastResult: DrainResult | null
  refresh: () => void
}

/**
 * Starts the background outbox drain once and exposes the pending count
 * for queue badges. Refresh after local enqueue/remove actions.
 */
export function useOutboxSync(): OutboxSyncState {
  const [pendingCount, setPendingCount] = useState(0)
  const [lastResult, setLastResult] = useState<DrainResult | null>(null)

  const refresh = useCallback(() => {
    getOutboxStore()
      .listPending()
      .then((items) => setPendingCount(items.length))
      .catch(() => setPendingCount(0))
  }, [])

  useEffect(() => {
    ensureOutboxSyncStarted({
      onDrainEnd: (result) => {
        setLastResult(result)
        refresh()
      },
    })
    refresh()
  }, [refresh])

  return { pendingCount, lastResult, refresh }
}

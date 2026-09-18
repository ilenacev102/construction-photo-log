'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ──

export interface Label {
  id: string
  group_id: string
  name: string
  slug: string
  color: string
  sort_order: number
}

export interface LabelGroup {
  id: string
  name: string
  slug: string
  color: string
  sort_order: number
  selection_mode: 'single' | 'multi'
  required: boolean
  labels: Label[]
}

// ── Loader ──

async function loadLabelGroups(): Promise<LabelGroup[]> {
  const res = await fetch('/api/labels/groups', { credentials: 'include' })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return (json.data ?? []) as LabelGroup[]
}

// ── Hook ──

interface UseLabelsReturn {
  groups: LabelGroup[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useLabels(): UseLabelsReturn {
  const [groups, setGroups] = useState<LabelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      const data = await loadLabelGroups()
      setGroups(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch labels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const data = await loadLabelGroups()
        if (!ignore) setGroups(data)
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to fetch labels')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [])

  return { groups, loading, error, refetch }
}

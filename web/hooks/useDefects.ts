'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Defect, DefectStatus, DefectSeverity } from '@/types/database'
import { monitoring } from '@/lib/monitoring'

interface UseDefectsOptions {
  projectId: string
  statusFilter?: DefectStatus | 'all'
}

async function loadDefects(projectId: string, statusFilter: DefectStatus | 'all'): Promise<Defect[]> {
  const supabase = createClient()
  let query = supabase
    .from('defects')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Defect[]
}

export function useDefects({ projectId, statusFilter = 'all' }: UseDefectsOptions) {
  const [defects, setDefects] = useState<Defect[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await loadDefects(projectId, statusFilter)
      setDefects(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load defects')
      monitoring.captureException(err, { extra: { hook: 'useDefects', projectId } })
    } finally {
      setIsLoading(false)
    }
  }, [projectId, statusFilter])

  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const data = await loadDefects(projectId, statusFilter)
        if (ignore) return
        setDefects(data)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError(err instanceof Error ? err.message : 'Failed to load defects')
        monitoring.captureException(err, { extra: { hook: 'useDefects', projectId } })
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [projectId, statusFilter])

  const createDefect = useCallback(async (defect: {
    title: string
    description?: string
    severity?: DefectSeverity
    assigned_to?: string
    location?: string
    photo_ids?: string[]
  }) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('defects')
      .insert({ project_id: projectId, ...defect })
      .select()
      .single()

    if (!error && data) {
      setDefects(prev => [data as Defect, ...prev])
      return data as Defect
    }
    throw error
  }, [projectId])

  const updatePhotoIds = useCallback(async (defectId: string, action: 'add' | 'remove', photoId: string) => {
    const res = await fetch(`/api/defects/${defectId}/photos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, photoId }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    if (json.data?.photo_ids) {
      setDefects(prev => prev.map(d => d.id === defectId ? { ...d, photo_ids: json.data.photo_ids } : d))
    }
    return json.data?.photo_ids as string[] | undefined
  }, [])

  const updateStatus = useCallback(async (defectId: string, status: DefectStatus, resolutionNotes?: string) => {
    const supabase = createClient()
    const updates: Partial<Defect> = { status }
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date().toISOString()
      if (resolutionNotes) updates.resolution_notes = resolutionNotes
    }
    const { data, error } = await supabase
      .from('defects')
      .update(updates)
      .eq('id', defectId)
      .select()
      .single()

    if (!error && data) {
      setDefects(prev => prev.map(d => d.id === defectId ? data as Defect : d))
    }
    return error
  }, [])

  return { defects, isLoading, error, refetch, createDefect, updateStatus, updatePhotoIds }
}

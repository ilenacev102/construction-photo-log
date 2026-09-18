'use client'

import { useEffect, useState, useCallback } from 'react'
import type { WorkOrder, WorkOrderPriority, WorkOrderStatus, Defect } from '@/types/database'
import { monitoring } from '@/lib/monitoring'

interface WorkOrdersQuery {
  projectId?: string
  statusFilter?: WorkOrderStatus | 'all'
  assignedTo?: string
}

async function loadWorkOrders(opts: WorkOrdersQuery): Promise<WorkOrder[]> {
  const params = new URLSearchParams()
  if (opts.projectId) params.set('projectId', opts.projectId)
  if (opts.statusFilter && opts.statusFilter !== 'all') params.set('statusFilter', opts.statusFilter)
  if (opts.assignedTo) params.set('assignedTo', opts.assignedTo)

  const qs = params.toString()
  const res = await fetch(`/api/work-orders${qs ? `?${qs}` : ''}`, { credentials: 'include' })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as WorkOrder[]
}

export function useWorkOrders({ projectId, statusFilter = 'all', assignedTo }: WorkOrdersQuery) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const data = await loadWorkOrders({ projectId, statusFilter, assignedTo })
        if (ignore) return
        setWorkOrders(data)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError(err instanceof Error ? err.message : 'Failed to load work orders')
        monitoring.captureException(err, { extra: { hook: 'useWorkOrders', projectId } })
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [projectId, statusFilter, assignedTo])

  const createWorkOrder = useCallback(async (input: {
    project_id: string
    title: string
    description?: string
    location?: string
    assigned_to?: string
    priority?: WorkOrderPriority
    due_date?: string
  }): Promise<WorkOrder> => {
    const res = await fetch('/api/work-orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    const created = json.data as WorkOrder
    setWorkOrders(prev => [created, ...prev])
    return created
  }, [])

  const updateStatus = useCallback(async (id: string, status: WorkOrderStatus): Promise<WorkOrder> => {
    const res = await fetch('/api/work-orders', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    const updated = json.data as WorkOrder
    setWorkOrders(prev => prev.map(w => w.id === id ? updated : w))
    return updated
  }, [])

  const updateWorkOrder = useCallback(async (id: string, updates: {
    title?: string
    description?: string
    location?: string
    assigned_to?: string
    priority?: WorkOrderPriority
    due_date?: string
  }): Promise<WorkOrder> => {
    const res = await fetch('/api/work-orders', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    const updated = json.data as WorkOrder
    setWorkOrders(prev => prev.map(w => w.id === id ? updated : w))
    return updated
  }, [])

  const deleteWorkOrder = useCallback(async (id: string): Promise<void> => {
    const res = await fetch('/api/work-orders', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    setWorkOrders(prev => prev.filter(w => w.id !== id))
  }, [])

  const linkDefect = useCallback(async (workOrderId: string, defectId: string): Promise<void> => {
    const res = await fetch(`/api/work-orders/${workOrderId}/defects`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defectId }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
  }, [])

  const unlinkDefect = useCallback(async (workOrderId: string, defectId: string): Promise<void> => {
    const res = await fetch(`/api/work-orders/${workOrderId}/defects`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defectId }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
  }, [])

  const getLinkedDefects = useCallback(async (workOrderId: string): Promise<Defect[]> => {
    const res = await fetch(`/api/work-orders/${workOrderId}/defects`, { credentials: 'include' })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    return json.data as Defect[]
  }, [])

  return { workOrders, isLoading, error, createWorkOrder, updateStatus, updateWorkOrder, deleteWorkOrder, linkDefect, unlinkDefect, getLinkedDefects }
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DrawingPin, PinType } from '@/types/database'

async function loadPins(photoId: string): Promise<DrawingPin[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drawing_pins')
    .select('*')
    .eq('photo_id', photoId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as DrawingPin[]
}

export function usePins(photoId: string) {
  const [pins, setPins] = useState<DrawingPin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      setPins(await loadPins(photoId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pins')
    } finally {
      setIsLoading(false)
    }
  }, [photoId])

  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const data = await loadPins(photoId)
        if (ignore) return
        setPins(data)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError(err instanceof Error ? err.message : 'Failed to load pins')
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [photoId])

  const addPin = useCallback(async (pin: {
    pin_type: PinType
    x: number
    y: number
    width?: number
    height?: number
    color?: string
    label?: string
    drawing_data?: Record<string, unknown>
  }) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('drawing_pins')
      .insert({ photo_id: photoId, user_id: user.id, ...pin })
      .select()
      .single()

    if (!error && data) {
      setPins(prev => [...prev, data as DrawingPin])
      return data as DrawingPin
    }
    throw error
  }, [photoId])

  const updatePin = useCallback(async (pinId: string, updates: Partial<DrawingPin>) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('drawing_pins')
      .update(updates)
      .eq('id', pinId)
      .select()
      .single()

    if (!error && data) {
      setPins(prev => prev.map(p => p.id === pinId ? data as DrawingPin : p))
    }
    return error
  }, [])

  const removePin = useCallback(async (pinId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('drawing_pins')
      .delete()
      .eq('id', pinId)

    if (!error) {
      setPins(prev => prev.filter(p => p.id !== pinId))
    }
    return error
  }, [])

  return { pins, isLoading, error, refetch, addPin, updatePin, removePin }
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AttendanceLog } from '@/types/database'
import { DEFAULT_TZ, todayStartInTz } from '@/lib/time'
import { monitoring } from '@/lib/monitoring'

async function loadTodayLog(
  projectId: string,
  tz: string,
): Promise<{ hasUser: boolean; data: AttendanceLog | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasUser: false, data: null }

  const todayStr = todayStartInTz(tz).toISOString()

  const { data } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .gte('check_in', todayStr)
    .order('check_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { hasUser: true, data: data ? (data as AttendanceLog) : null }
}

export function useAttendance(projectId: string, tz: string = DEFAULT_TZ) {
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    const run = async () => {
      const result = await loadTodayLog(projectId, tz)
      if (!result.hasUser) return
      if (!ignore) {
        if (result.data) {
          setTodayLog(result.data)
        }
        setIsLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [projectId, tz])

  useEffect(() => {
    let ignore = false
    const run = async () => {
      const supabase = createClient()
      try {
        const { data } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('project_id', projectId)
          .order('check_in', { ascending: false })
          .limit(50)
        if (!ignore && data) setLogs(data as AttendanceLog[])
      } catch (err) {
        if (!ignore) monitoring.captureException(err, { extra: { hook: 'useAttendance' } })
      }
    }
    void run()
    return () => { ignore = true }
  }, [projectId])

  const checkIn = useCallback(async (note?: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ project_id: projectId, user_id: user.id, note: note ?? '' })
      .select()
      .single()

    if (!error && data) {
      setTodayLog(data as AttendanceLog)
      setLogs(prev => [data as AttendanceLog, ...prev])
      return data as AttendanceLog
    }
    throw error
  }, [projectId])

  const checkOut = useCallback(async () => {
    if (!todayLog?.id) throw new Error('Not checked in')
    const supabase = createClient()

    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ check_out: new Date().toISOString() })
      .eq('id', todayLog.id)
      .select()
      .single()

    if (!error && data) {
      setTodayLog(data as AttendanceLog)
      setLogs(prev => prev.map(l => l.id === data.id ? data as AttendanceLog : l))
      return data as AttendanceLog
    }
    throw error
  }, [todayLog])

  return { todayLog, logs, isLoading, checkIn, checkOut }
}
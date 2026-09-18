'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'

interface NotificationComment {
  id: string
  body: string
  entity_type: string
  entity_id: string
  project_id: string
  author: { full_name: string } | null
}

interface Notification {
  id: string
  user_id: string
  type: 'mention' | 'reply'
  comment_id: string | null
  read: boolean
  created_at: string
  comment: NotificationComment | null
}

function timeAgo(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('daysAgo', { count: days })
}

export function NotificationDropdown() {
  const t = useTranslations('notifications')
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Poll for unread count every 30s + re-fetch on tab focus
  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications?countOnly=true')
        const json = await res.json()
        if (!cancelled && res.ok) setUnreadCount(json.data?.unreadCount ?? 0)
      } catch { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchCount()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Real-time: subscribe to new notifications for instant badge update
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notifications:badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          // New notification arrived — increment badge count immediately
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fetch full notification list when opened
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    async function fetchNotifications() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/notifications?unreadOnly=true')
        const json = await res.json()
        if (!cancelled) setNotifications(json.data ?? [])
      } catch { /* silent */ }
      if (!cancelled) setIsLoading(false)
    }
    fetchNotifications()
    return () => { cancelled = true }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  async function handleNotificationClick(notification: Notification) {
    // Mark as read
    if (!notification.read) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }

    // Navigate to the entity
    const comment = notification.comment
    if (!comment) return

    setIsOpen(false)

    if (comment.entity_type === 'photo') {
      router.push(`/projects/${comment.project_id}/photos`)
    } else if (comment.entity_type === 'defect') {
      router.push(`/projects/${comment.project_id}/defects`)
    } else if (comment.entity_type === 'work_order') {
      router.push('/work-orders')
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative grid size-8 place-items-center rounded-xs text-muted-foreground transition-colors duration-180 ease-apple-spring hover:bg-surface-sunken hover:text-foreground',
          isOpen && 'bg-surface-sunken text-foreground'
        )}
        aria-label={t('bellLabel')}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-md border border-border-strong bg-surface-raised shadow-elevation-3"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-xs font-semibold text-foreground">{t('title')}</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {t('unread', { count: unreadCount })}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {t('loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {t('empty')}
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken',
                    !n.read && 'bg-accent/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">
                          {n.comment?.author?.full_name ?? t('unknownUser')}
                        </span>{' '}
                        {n.type === 'mention' ? t('mentionedYou') : t('repliedToYou')}
                      </p>
                      {n.comment?.body && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {n.comment.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {timeAgo(n.created_at, t)}
                        {n.comment?.entity_type && (
                          <> · {t(`entity.${n.comment.entity_type}`)}</>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

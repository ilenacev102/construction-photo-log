'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import type { CommentWithAuthor } from '@/types/database'

interface CommentThreadProps {
  projectId: string
  entityType: string
  entityId: string
  currentUserId?: string
}

export function CommentThread({
  projectId,
  entityType,
  entityId,
  currentUserId,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entityType, entityId })
      const response = await fetch(
        `/api/projects/${projectId}/comments?${params.toString()}`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch comments')
      }

      setComments(result.data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, entityType, entityId])

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const params = new URLSearchParams({ entityType, entityId })
        const res = await fetch(`/api/projects/${projectId}/comments?${params.toString()}`)
        const json = await res.json()
        if (!cancelled) {
          if (!res.ok) throw new Error(json.error || 'Failed to fetch comments')
          setComments(json.data || [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch comments')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId, entityType, entityId])

  // Real-time: subscribe to new comments on this entity
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`comments:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `entity_type=eq.${entityType}`, // Note: Supabase filter doesn't support multi-column, we verify entity_id in callback
        },
        async (payload) => {
          const newComment = payload.new as { id: string; entity_id: string; user_id: string; body: string; parent_id: string | null; created_at: string; entity_type: string; updated_at: string }

          // Verify this comment belongs to our entity
          if (newComment.entity_id !== entityId) return

          // Fetch the full comment with author data via API
          try {
            const res = await fetch(`/api/projects/${projectId}/comments?entityType=${entityType}&entityId=${entityId}`)
            const json = await res.json()
            if (res.ok) setComments(json.data || [])
          } catch {
            // Silent — we'll reconcile on next poll/fetch
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `entity_type=eq.${entityType}`,
        },
        (payload) => {
          const deletedId = payload.old?.id
          if (deletedId) {
            setComments((prev) => prev.filter((c) => c.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [entityType, entityId, projectId])

  const handleDelete = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  return (
    <div className="space-y-4">
      <CommentForm
        projectId={projectId}
        entityType={entityType}
        entityId={entityId}
        onSubmit={fetchComments}
      />

      {isLoading && (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Се вчитуваат коментари...
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive py-4 text-center">
          {error}
        </div>
      )}

      {!isLoading && !error && comments.length === 0 && (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Нема коментари. Бидете првиот!
        </div>
      )}

      {!isLoading && !error && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              projectId={projectId}
              entityType={entityType}
              entityId={entityId}
              currentUserId={currentUserId}
              onDelete={handleDelete}
              onRefresh={fetchComments}
            />
          ))}
        </div>
      )}
    </div>
  )
}

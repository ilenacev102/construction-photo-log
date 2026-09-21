'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CommentForm } from './CommentForm'
import type { CommentWithAuthor } from '@/types/database'

interface CommentItemProps {
  comment: CommentWithAuthor
  projectId: string
  entityType: string
  entityId: string
  currentUserId?: string
  onDelete?: (commentId: string) => void
  onRefresh?: () => void
}

export function CommentItem({
  comment,
  projectId,
  entityType,
  entityId,
  currentUserId,
  onDelete,
  onRefresh,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('Дали сте сигурни дека сакате да го избришете овој коментар?')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/comments/${comment.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onDelete?.(comment.id)
        onRefresh?.()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'Токму сега'
    if (diffMin < 60) return `пред ${diffMin} ${diffMin === 1 ? 'минута' : 'минути'}`
    if (diffHour < 24) return `пред ${diffHour} ${diffHour === 1 ? 'час' : 'часа'}`
    if (diffDay < 7) return `пред ${diffDay} ${diffDay === 1 ? 'ден' : 'дена'}`

    return date.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Mention pattern shared with the server. Rendered as React nodes —
  // plain strings are escaped by React, so HTML in comment bodies can
  // never become executable markup (stored-XSS fix).
  const MENTION_PATTERN =
    /(@[\w\u0400-\u04FF\u0500-\u052F]+(?:[\s-]+[\w\u0400-\u04FF\u0500-\u052F]+)*)/g

  function renderCommentBody(text: string) {
    return text.split(MENTION_PATTERN).map((part, i) =>
      part.startsWith('@') && part.length > 1 ? (
        <span key={i} className="text-primary font-medium">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  }

  const isAuthor = currentUserId === comment.user_id
  const authorName = comment.author?.full_name || 'Непознат'
  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
        {comment.author?.avatar_url ? (
          <Image
            unoptimized
            src={comment.author.avatar_url}
            alt={authorName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{authorName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
        </div>
        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
          {renderCommentBody(comment.body)}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            Одговори
          </Button>
          {isAuthor && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              Избриши
            </Button>
          )}
        </div>

        {showReplyForm && (
          <div className="mt-2">
            <CommentForm
              projectId={projectId}
              entityType={entityType}
              entityId={entityId}
              parentId={comment.id}
              onCancel={() => setShowReplyForm(false)}
              onSubmit={() => {
                setShowReplyForm(false)
                onRefresh?.()
              }}
            />
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-muted">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                projectId={projectId}
                entityType={entityType}
                entityId={entityId}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

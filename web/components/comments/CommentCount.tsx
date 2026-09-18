'use client'

import { useState, useEffect } from 'react'

interface CommentCountProps {
  projectId: string
  entityType: string
  entityId: string
}

export function CommentCount({ projectId, entityType, entityId }: CommentCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const params = new URLSearchParams({
          entityType,
          entityId,
        })

        const response = await fetch(
          `/api/projects/${projectId}/comments?${params.toString()}`
        )
        const result = await response.json()

        if (response.ok && result.data) {
          // Count top-level comments + all replies
          const total = result.data.reduce(
            (acc: number, comment: { replies?: unknown[] }) =>
              acc + 1 + (comment.replies?.length || 0),
            0
          )
          setCount(total)
        }
      } catch {
        // Silently fail - count is non-critical
      }
    }

    fetchCount()
  }, [projectId, entityType, entityId])

  if (count === null || count === 0) return null

  return (
    <span className="text-xs text-muted-foreground">
      {count} {count === 1 ? 'коментар' : 'коментари'}
    </span>
  )
}

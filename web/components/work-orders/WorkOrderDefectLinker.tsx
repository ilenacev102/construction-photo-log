'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Link2, Unlink } from 'lucide-react'
import type { Defect } from '@/types/database'

interface WorkOrderDefectLinkerProps {
  linkedDefects: Defect[]
  allDefects: Defect[]
  canWrite: boolean
  onLink: (defectId: string) => Promise<void>
  onUnlink: (defectId: string) => Promise<void>
}

export function WorkOrderDefectLinker({
  linkedDefects,
  allDefects,
  canWrite,
  onLink,
  onUnlink,
}: WorkOrderDefectLinkerProps) {
  const t = useTranslations('workOrders')
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)

  const linkedIds = new Set(linkedDefects.map((d) => d.id))
  const availableDefects = allDefects.filter((d) => !linkedIds.has(d.id))

  const handleLink = useCallback(async (defectId: string) => {
    setLoading(true)
    try {
      await onLink(defectId)
      setShowPicker(false)
    } finally {
      setLoading(false)
    }
  }, [onLink])

  const handleUnlink = useCallback(async (defectId: string) => {
    setLoading(true)
    try {
      await onUnlink(defectId)
    } finally {
      setLoading(false)
    }
  }, [onUnlink])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          {t('linkedDefects')} ({linkedDefects.length})
        </h4>
        {canWrite && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => setShowPicker(!showPicker)}
            disabled={loading}
          >
            <Link2 className="size-3.5" />
            {t('linkDefect')}
          </Button>
        )}
      </div>

      {linkedDefects.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('noLinkedDefects')}</p>
      ) : (
        <div className="space-y-2">
          {linkedDefects.map((defect) => (
            <div
              key={defect.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{defect.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    defect.status === 'open' && 'bg-amber-500/10 text-amber-700',
                    defect.status === 'in_progress' && 'bg-blue-500/10 text-blue-700',
                    defect.status === 'resolved' && 'bg-emerald-500/10 text-emerald-700',
                    defect.status === 'closed' && 'bg-muted text-muted-foreground',
                  )}>
                    {defect.status}
                  </span>
                  <span className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    defect.severity === 'low' && 'bg-muted text-muted-foreground',
                    defect.severity === 'medium' && 'bg-amber-500/10 text-amber-700',
                    defect.severity === 'high' && 'bg-red-500/10 text-red-700',
                    defect.severity === 'critical' && 'bg-red-500/20 text-red-800',
                  )}>
                    {defect.severity}
                  </span>
                </div>
              </div>
              {canWrite && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void handleUnlink(defect.id)}
                  disabled={loading}
                >
                  <Unlink className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs font-medium mb-2">{t('selectDefectToLink')}</p>
          {availableDefects.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('noAvailableDefects')}</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableDefects.map((defect) => (
                <button
                  key={defect.id}
                  className="w-full text-left rounded p-2 hover:bg-muted transition-colors"
                  onClick={() => void handleLink(defect.id)}
                  disabled={loading}
                >
                  <p className="text-sm font-medium">{defect.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      defect.status === 'open' && 'bg-amber-500/10 text-amber-700',
                      defect.status === 'in_progress' && 'bg-blue-500/10 text-blue-700',
                      defect.status === 'resolved' && 'bg-emerald-500/10 text-emerald-700',
                      defect.status === 'closed' && 'bg-muted text-muted-foreground',
                    )}>
                      {defect.status}
                    </span>
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      defect.severity === 'low' && 'bg-muted text-muted-foreground',
                      defect.severity === 'medium' && 'bg-amber-500/10 text-amber-700',
                      defect.severity === 'high' && 'bg-red-500/10 text-red-700',
                      defect.severity === 'critical' && 'bg-red-500/20 text-red-800',
                    )}>
                      {defect.severity}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

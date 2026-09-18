'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  PERMISSION_CATEGORIES,
  type Permission,
} from '@/types/database'
import { apiGet, apiPost } from '@/lib/supabase/queries'

async function loadPermissionData(userId: string): Promise<{ catalog: Permission[]; userPermissions: string[] }> {
  const [catalog, perms] = await Promise.all([
    apiGet<Permission[]>('/api/permissions'),
    apiGet<string[]>(`/api/permissions?mode=user&userId=${encodeURIComponent(userId)}`),
  ])
  return { catalog: catalog ?? [], userPermissions: perms ?? [] }
}

interface PermissionEditorProps {
  userId: string
  userName: string
  open: boolean
  onClose: () => void
}

/**
 * Modal for viewing and editing a user's permissions.
 * Groups permissions by category and provides toggle switches.
 * Fetches the full permission catalog and the user's current granted permissions.
 * Saves changes immediately when toggled via POST /api/permissions.
 */
export default function PermissionEditor({
  userId,
  userName,
  open,
  onClose,
}: PermissionEditorProps) {
  const t = useTranslations('permissionEditor')
  const common = useTranslations('common')
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let ignore = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { catalog, userPermissions } = await loadPermissionData(userId)
        if (!ignore) {
          setAllPermissions(catalog)
          setUserPermissions(userPermissions)
        }
      } catch {
        if (!ignore) {
          setError(t('loadError'))
          setAllPermissions([])
          setUserPermissions([])
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void run()
    return () => { ignore = true }
  }, [open, userId, t])

  const handleToggle = useCallback(
    async (permissionKey: string, granted: boolean) => {
      setSavingKey(permissionKey)
      setError(null)
      try {
        await apiPost('/api/permissions', {
          userId,
          permissionKey,
          granted,
        })
        setUserPermissions((prev) =>
          granted
            ? [...prev, permissionKey]
            : prev.filter((k) => k !== permissionKey),
        )
      } catch {
        setError(`Failed to update permission "${permissionKey}"`)
      }
      setSavingKey(null)
    },
    [userId],
  )

  if (!open) return null

  // Group permissions by category
  const grouped = allPermissions.reduce<
    Record<string, { key: string; name: string; description: string }[]>
  >((acc, perm) => {
    const category = perm.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push({
      key: perm.key,
      name: perm.name,
      description: perm.description,
    })
    return acc
  }, {})

  const sortedCategories = Object.keys(PERMISSION_CATEGORIES).filter(
    (cat) => grouped[cat] && grouped[cat].length > 0,
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-lg font-semibold">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{userName}</DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && sortedCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {t('empty')}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            sortedCategories.map((category) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {PERMISSION_CATEGORIES[category] ?? category}
                </h3>
                <div className="space-y-2">
                  {(grouped[category] ?? []).map((perm) => {
                    const granted = userPermissions.includes(perm.key)
                    const isSaving = savingKey === perm.key
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                      >
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium">{perm.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isSaving && (
                            <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                          )}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={granted}
                            disabled={isSaving}
                            onClick={() => handleToggle(perm.key, !granted)}
                            className={cn(
                              'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              'disabled:cursor-not-allowed disabled:opacity-50',
                              granted ? 'bg-primary' : 'bg-input',
                            )}
                          >
                            <span
                              className={cn(
                                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                                granted ? 'translate-x-4' : 'translate-x-0',
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {common('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

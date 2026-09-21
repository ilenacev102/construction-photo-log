'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRole } from '@/hooks/useRole'
import { Link } from '@/i18n/navigation'
import dynamic from 'next/dynamic'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/data-table'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Profile, UserRole } from '@/types/database'

const ALL_ROLES: UserRole[] = [
  'photographer',
  'foreman',
  'site_manager',
  'client',
  'admin',
]

function roleLabel(t: (key: string) => string, role: UserRole): string {
  switch (role) {
    case 'site_manager': return t('roles.siteManager')
    case 'admin': return t('roles.admin')
    case 'photographer': return t('roles.photographer')
    case 'foreman': return t('roles.foreman')
    case 'client': return t('roles.client')
    default: return role
  }
}

const PermissionEditor = dynamic(
  () => import('@/components/PermissionEditor'),
  { ssr: false },
)

export default function AdminTeamPage() {
  const t = useTranslations('adminUsers')
  const common = useTranslations('common')
  const { isAdmin, isManager, isLoading: roleLoading } = useRole()

  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [permEditorOpen, setPermEditorOpen] = useState(false)

  const canManage = isAdmin || isManager

  useEffect(() => {
    if (roleLoading) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/team', { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && !json.error) {
          setUsers(json.data as Profile[])
          setLoading(false)
        } else if (!cancelled) {
          setError(json.error ?? common('error'))
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(common('error'))
          setLoading(false)
        }
      }
    })()

    return () => { cancelled = true }
  }, [roleLoading, common])

  const handleRoleChange = useCallback(
    async (userId: string, newRole: UserRole) => {
      setSavingId(userId)
      try {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId, role: newRole }),
        })
        const json = await res.json()
        if (!json.error && json.data) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
          )
        }
      } catch {
        // ignore
      }
      setSavingId(null)
    },
    [],
  )

  const filtered = search
    ? users.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          u.company_name?.toLowerCase().includes(search.toLowerCase()),
      )
    : users

  // Loading
  if (roleLoading || loading) {
    return <LoadingBlock className="py-32" />
  }

  // Not admin or manager
  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-lg font-semibold">{common('accessDenied')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {common('accessDeniedDesc')}
        </p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          {common('backToDashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title={t('teamManagement')} />

      {error ? <ErrorAlert message={error} className="mt-6" /> : null}

      <div className="mt-6 max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('search')}
          ariaLabel={t('search')}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('noUsers')} className="mt-8" />
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead>{t('company')}</TableHead>
                <TableHead>{t('joined')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <span className="rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                      {roleLabel(t, user.role)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.company_name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as UserRole)
                        }
                        disabled={savingId === user.id}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(t, role)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user)
                          setPermEditorOpen(true)
                        }}
                      >
                        {t('permissions')}
                      </Button>
                      {savingId === user.id && (
                        <span className="text-xs text-muted-foreground">
                          {t('saving')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {permEditorOpen && selectedUser && (
        <PermissionEditor
          userId={selectedUser.id}
          userName={selectedUser.full_name}
          open={permEditorOpen}
          onClose={() => {
            setPermEditorOpen(false)
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}

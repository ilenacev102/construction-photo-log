'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRole } from '@/hooks/useRole'
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  getProjectTeam,
} from '@/lib/supabase/queries'
import type { Profile, ProjectMemberRole, ProjectMemberWithProfile } from '@/types/database'

const MEMBER_ROLE_VALUES: ProjectMemberRole[] = ['photographer', 'foreman', 'site_manager', 'client']

interface MembersPanelProps {
  projectId: string
}

async function fetchMembersData(
  projectId: string,
  withTeam: boolean,
): Promise<{ members: ProjectMemberWithProfile[]; team: Profile[] }> {
  const [memberList, teamList] = await Promise.all([
    getProjectMembers(projectId),
    withTeam ? getProjectTeam(projectId) : Promise.resolve([]),
  ])
  return { members: memberList, team: teamList }
}

export default function MembersPanel({ projectId }: MembersPanelProps) {
  const t = useTranslations('projectMembers')
  const { canManage } = useRole()

  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>('client')

  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const data = await fetchMembersData(projectId, canManage)
        if (ignore) return
        setMembers(data.members)
        setTeam(data.team)
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void run()
    return () => {
      ignore = true
    }
  }, [projectId, canManage])

  async function reload() {
    const data = await fetchMembersData(projectId, canManage)
    setMembers(data.members)
    setTeam(data.team)
  }

  const memberIds = new Set(members.map((m) => m.user_id))
  const candidates = team.filter((p) => !memberIds.has(p.id) && p.role !== 'admin')

  async function handleAdd() {
    if (!selectedUserId) return
    setSaving(true)
    setError(null)
    try {
      await addProjectMember(projectId, selectedUserId, selectedRole)
      setSelectedUserId('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!window.confirm(t('confirmRemove') + ` (${name})`)) return
    setSaving(true)
    setError(null)
    try {
      await removeProjectMember(projectId, userId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-4 border-border border-t-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const profile = member.profiles
                const name = profile?.full_name || profile?.id || member.user_id
                return (
                  <li key={member.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(`roles.${member.role}`)}
                        {profile?.company_name ? ` · ${profile.company_name}` : ''}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(member.user_id, name)}
                        disabled={saving}
                      >
                        {t('remove')}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('addMember')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label={t('selectUser')}
              >
                <option value="">{t('selectUser')}</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name || candidate.id}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as ProjectMemberRole)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label={t('selectRole')}
              >
                {MEMBER_ROLE_VALUES.map((role) => (
                  <option key={role} value={role}>
                    {t(`roles.${role}`)}
                  </option>
                ))}
              </select>
              <Button onClick={handleAdd} disabled={!selectedUserId || saving}>
                {saving ? t('loading') : t('add')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

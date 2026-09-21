'use client'

import { useTranslations } from 'next-intl'
import { Tag } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/loading-block'
import { ErrorAlert } from '@/components/ui/error-alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/labels/confirm-dialog'
import { GroupForm } from '@/components/labels/group-form'
import { GroupCard } from '@/components/labels/group-card'
import { useLabelAdmin } from '@/components/labels/use-label-admin'

// ── AdminLabelsPage ──

export default function AdminLabelsPage() {
  const t = useTranslations('labelsAdmin')
  const {
    groups,
    loading,
    error,
    expanded,
    addingGroup,
    editingGroupId,
    addingLabelForGroup,
    editingLabelId,
    saving,
    apiError,
    confirmDelete,
    groupForm,
    labelForm,
    toggleExpand,
    resetGroupForm,
    resetLabelForm,
    startEditGroup,
    startEditLabel,
    handleSaveGroup,
    handleDeleteGroup,
    handleSaveLabel,
    handleDeleteLabel,
    setAddingGroup,
    setEditingGroupId,
    setAddingLabelForGroup,
    setEditingLabelId,
    setConfirmDelete,
    setGroupForm,
    setLabelForm,
  } = useLabelAdmin()

  // ── Loading ──
  if (loading) {
    return <LoadingBlock className="py-32" />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            type="button"
            onClick={() => {
              setAddingGroup(true)
              setEditingGroupId(null)
              resetGroupForm()
            }}
            disabled={saving}
          >
            {t('addGroup')}
          </Button>
        }
      />

      {apiError && <ErrorAlert message={apiError} className="mt-4" />}
      {error && <ErrorAlert message={error} className="mt-4" />}

      <div className="mt-6 space-y-4">
        {addingGroup && (
          <div className="rounded-md border border-border bg-surface-raised p-5 shadow-elevation-1">
            <h3 className="text-sm font-semibold mb-4">{t('newGroup')}</h3>
            <GroupForm
              form={groupForm}
              onChange={setGroupForm}
              saving={saving}
              onSave={() => handleSaveGroup()}
              onCancel={() => { setAddingGroup(false); resetGroupForm() }}
            />
          </div>
        )}

        {groups.length === 0 && !addingGroup ? (
          <EmptyState
            icon={Tag}
            title={t('noGroups')}
            description={t('noGroupsHint')}
            className="mt-6 py-16"
          />
        ) : (
          groups
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                expanded={expanded.has(group.id)}
                editing={editingGroupId === group.id}
                addingLabel={addingLabelForGroup === group.id}
                editingLabelId={editingLabelId}
                groupForm={groupForm}
                labelForm={labelForm}
                saving={saving}
                onToggleExpand={() => toggleExpand(group.id)}
                onStartEdit={() => startEditGroup(group)}
                onDelete={() => setConfirmDelete({ type: 'group', id: group.id, name: group.name })}
                onSaveGroup={() => handleSaveGroup(group.id)}
                onCancelEdit={() => { setEditingGroupId(null); resetGroupForm() }}
                onStartAddLabel={() => {
                  setAddingLabelForGroup(group.id)
                  setEditingLabelId(null)
                  resetLabelForm()
                }}
                onCancelAddLabel={() => { setAddingLabelForGroup(null); resetLabelForm() }}
                onSaveLabel={(id) => handleSaveLabel(id, group.id)}
                onCancelEditLabel={() => { setEditingLabelId(null); resetLabelForm() }}
                onStartEditLabel={(label) => startEditLabel(label)}
                onDeleteLabel={(label) =>
                  setConfirmDelete({ type: 'label', id: label.id, name: label.name })
                }
                onGroupFormChange={setGroupForm}
                onLabelFormChange={setLabelForm}
              />
            ))
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.type === 'group' ? t('deleteGroup') : t('deleteLabel')}
        message={
          confirmDelete
            ? confirmDelete.type === 'group'
              ? t('deleteConfirmGroup', { name: confirmDelete.name })
              : t('deleteConfirm', { name: confirmDelete.name })
            : ''
        }
        onConfirm={() => {
          if (!confirmDelete) return
          if (confirmDelete.type === 'group') handleDeleteGroup(confirmDelete.id)
          else handleDeleteLabel(confirmDelete.id)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
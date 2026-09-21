'use client'

import { useTranslations } from 'next-intl'
import { LabelBadge } from '@/components/labels/LabelBadge'
import { ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GroupForm } from '@/components/labels/group-form'
import { LabelForm } from '@/components/labels/label-form'
import { cn } from '@/lib/utils'
import type { LabelGroup, Label } from '@/hooks/useLabels'
import type { GroupFormState, LabelFormState } from '@/components/labels/labels-utils'

// ── GroupCard ──

function GroupCard({
  group,
  expanded,
  editing,
  addingLabel,
  editingLabelId,
  groupForm,
  labelForm,
  saving,
  onToggleExpand,
  onStartEdit,
  onDelete,
  onSaveGroup,
  onCancelEdit,
  onStartAddLabel,
  onCancelAddLabel,
  onSaveLabel,
  onCancelEditLabel,
  onStartEditLabel,
  onDeleteLabel,
  onGroupFormChange,
  onLabelFormChange,
}: {
  group: LabelGroup
  expanded: boolean
  editing: boolean
  addingLabel: boolean
  editingLabelId: string | null
  groupForm: GroupFormState
  labelForm: LabelFormState
  saving: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onDelete: () => void
  onSaveGroup: () => void
  onCancelEdit: () => void
  onStartAddLabel: () => void
  onCancelAddLabel: () => void
  onSaveLabel: (id: string | undefined) => void
  onCancelEditLabel: () => void
  onStartEditLabel: (label: Label) => void
  onDeleteLabel: (label: Label) => void
  onGroupFormChange: (f: GroupFormState) => void
  onLabelFormChange: (f: LabelFormState) => void
}) {
  const t = useTranslations('labelsAdmin')
  return (
    <div className="rounded-md border border-border bg-surface-raised shadow-elevation-1 overflow-hidden">
      {editing ? (
        <div className="p-5">
          <h3 className="text-sm font-semibold mb-4">{t('editGroup')}</h3>
          <GroupForm
            form={groupForm}
            onChange={onGroupFormChange}
            saving={saving}
            onSave={onSaveGroup}
            onCancel={onCancelEdit}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-5 py-3">
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <span
                className="inline-block size-3 rounded-full shrink-0"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-sm font-medium">{group.name}</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-xs px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                  group.selection_mode === 'single'
                    ? 'bg-accent-muted/40 text-accent'
                    : 'border border-border bg-surface-sunken text-muted-foreground',
                )}
              >
                {t(group.selection_mode === 'single' ? 'single' : 'multi')}
              </span>
              {group.required && (
                <span className="inline-flex items-center rounded-xs bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                  {t('required')}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {t('labelCount', { count: group.labels.length })}
              </span>
              <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
            </button>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('editLabelAria', { name: group.name })}
                onClick={onStartEdit}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('deleteLabelAria', { name: group.name })}
                className="hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {expanded && (
            <div className="border-t border-border px-5 py-4 space-y-3">
              {group.labels
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((label) =>
                  editingLabelId === label.id ? (
                    <div key={label.id} className="rounded-md border border-border bg-surface-sunken/50 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-3">{t('editLabel')}</h4>
                      <LabelForm
                        form={labelForm}
                        onChange={onLabelFormChange}
                        saving={saving}
                        onSave={() => onSaveLabel(label.id)}
                        onCancel={onCancelEditLabel}
                      />
                    </div>
                  ) : (
                    <div
                      key={label.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-surface-sunken/40 px-3 py-2"
                    >
                      <LabelBadge label={label} />
                      <span className="text-xs text-muted-foreground ml-1">
                        {t('sortValue', { value: label.sort_order })}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t('editLabelAria', { name: label.name })}
                          onClick={() => onStartEditLabel(label)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t('deleteLabelAria', { name: label.name })}
                          className="hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDeleteLabel(label)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ),
                )}

              {addingLabel ? (
                <div className="rounded-md border border-border bg-surface-sunken/50 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3">{t('newLabel')}</h4>
                  <LabelForm
                    form={labelForm}
                    onChange={onLabelFormChange}
                    saving={saving}
                    onSave={() => onSaveLabel(undefined)}
                    onCancel={onCancelAddLabel}
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={onStartAddLabel}
                >
                  <Plus className="size-3.5" />
                  {t('addLabel')}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { GroupCard }
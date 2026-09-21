'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { LabelGroup, Label } from '@/hooks/useLabels'

interface LabelPickerProps {
  groups: LabelGroup[]
  selected: Label[]
  onChange: (labels: Label[]) => void
}

export function LabelPicker({ groups, selected, onChange }: LabelPickerProps) {
  const t = useTranslations('labels')
  const isSelected = useCallback(
    (label: Label) => selected.some((s) => s.id === label.id),
    [selected],
  )

  const handleToggle = useCallback(
    (group: LabelGroup, label: Label) => {
      if (group.selection_mode === 'single') {
        // Radio-style: replace the entire group's selection
        if (isSelected(label)) return // already selected, keep it
        const others = selected.filter((s) => s.group_id !== group.id)
        onChange([...others, label])
      } else {
        // Multi: toggle on/off
        const groupSelected = selected.filter((s) => s.group_id === group.id)
        if (isSelected(label)) {
          // Prevent deselecting all if group is required
          if (group.required && groupSelected.length === 1) return
          onChange(selected.filter((s) => s.id !== label.id))
        } else {
          onChange([...selected, label])
        }
      }
    },
    [selected, onChange, isSelected],
  )

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupSelectedCount = selected.filter(
          (s) => s.group_id === group.id,
        ).length

        return (
          <div key={group.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-sm font-medium">{group.name}</span>
              {groupSelectedCount > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  ({groupSelectedCount} selected)
                </span>
              )}
              {group.required && (
                <span className="text-[10px] text-muted-foreground">*</span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {group.selection_mode === 'single' ? '(select one)' : '(multi)'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {group.labels.map((label) => {
                const selected = isSelected(label)

                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => handleToggle(group, label)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-transparent shadow-xs'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                    style={
                      selected
                        ? {
                            backgroundColor: `${label.color}18`,
                            borderColor: label.color,
                            color: label.color,
                          }
                        : undefined
                    }
                    aria-pressed={selected}
                  >
                    {group.selection_mode === 'multi' && (
                      <span
                        className={cn(
                          'flex size-3.5 items-center justify-center rounded-[3px] border transition-colors',
                          selected
                            ? 'border-transparent'
                            : 'border-muted-foreground/30',
                        )}
                        style={
                          selected
                            ? { backgroundColor: label.color }
                            : undefined
                        }
                      >
                        {selected && (
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                            className="text-white"
                          >
                            <path
                              d="M1.5 4L3.5 6L6.5 2"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                    {label.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {groups.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
    </div>
  )
}

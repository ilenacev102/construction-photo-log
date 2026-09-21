'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { LabelGroup } from '@/hooks/useLabels'

interface LabelFilterBarProps {
  groups: LabelGroup[]
  activeFilters: Record<string, string[]>
  onChange: (groupId: string, slugs: string[]) => void
}

export function LabelFilterBar({ groups, activeFilters, onChange }: LabelFilterBarProps) {
  const t = useTranslations('labels')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const toggleLabel = useCallback(
    (groupId: string, slug: string) => {
      const current = activeFilters[groupId] ?? []
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
      onChange(groupId, next)
    },
    [activeFilters, onChange],
  )

  const hasActiveFilters = Object.values(activeFilters).some(
    (slugs) => slugs.length > 0,
  )

  const clearAll = useCallback(() => {
    groups.forEach((g) => onChange(g.id, []))
  }, [groups, onChange])

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Labels
          {hasActiveFilters && (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {
                Object.values(activeFilters).reduce(
                  (sum, slugs) => sum + slugs.length,
                  0,
                )
              }
            </span>
          )}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Group sections */}
      <div className="divide-y divide-border">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const activeSlugs = activeFilters[group.id] ?? []

          return (
            <div key={group.id}>
              {/* Group header / trigger */}
              <button
                type="button"
                onClick={() => toggleExpand(group.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                  'hover:bg-muted/50',
                  activeSlugs.length > 0 && 'bg-muted/30',
                )}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90',
                  )}
                >
                  <path
                    d="M3 1L7 5L3 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <span
                  className="inline-block size-2 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />

                <span className="font-medium">{group.name}</span>

                {activeSlugs.length > 0 && (
                  <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {activeSlugs.length}
                  </span>
                )}
              </button>

              {/* Label chips (collapsible) */}
              {isExpanded && (
                <div className="flex flex-wrap gap-1 px-3 pb-2 pt-1">
                  {group.labels.map((label) => {
                    const isActive = activeSlugs.includes(label.slug)

                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(group.id, label.slug)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-transparent shadow-xs'
                            : 'border-border bg-background hover:bg-muted',
                        )}
                        style={
                          isActive
                            ? {
                                backgroundColor: `${label.color}18`,
                                borderColor: label.color,
                                color: label.color,
                              }
                            : undefined
                        }
                        aria-pressed={isActive}
                      >
                        {label.name}
                      </button>
                    )
                  })}

                  {group.labels.length === 0 && (
                    <p className="py-1 text-[11px] text-muted-foreground">
                      {t('emptyGroup')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {groups.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t('emptyGroups')}
          </p>
        )}
      </div>
    </div>
  )
}

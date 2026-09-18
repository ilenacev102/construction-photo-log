'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface LabelBadgeLabel {
  name: string
  color: string
  slug?: string
}

interface LabelBadgeProps {
  label: LabelBadgeLabel
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function LabelBadge({ label, onRemove, size = 'sm' }: LabelBadgeProps) {
  const t = useTranslations('labels')
  const sizeClasses = size === 'sm'
    ? 'h-5 px-2 text-xs'
    : 'h-7 px-3 text-sm'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        sizeClasses,
      )}
      style={{
        backgroundColor: `${label.color}14`,
        borderColor: label.color,
        color: label.color,
      }}
    >
      <span className="truncate max-w-[120px]" title={label.name}>{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className={cn(
            'inline-flex items-center justify-center rounded-full transition-colors',
            'hover:bg-black/10 dark:hover:bg-white/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'sm' ? 'size-3.5 text-[10px]' : 'size-4 text-xs',
          )}
          aria-label={t('remove', { name: label.name })}
        >
          ✕
        </button>
      )}
    </span>
  )
}

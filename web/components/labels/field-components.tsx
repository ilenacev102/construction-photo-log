'use client'

import { Input } from '@/components/ui/input'
import { Label as UiLabel } from '@/components/ui/label'

// ── Inline Edit Fields ──

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <UiLabel className="text-xs font-medium text-muted-foreground">{label}</UiLabel>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <UiLabel className="text-xs font-medium text-muted-foreground">{label}</UiLabel>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <UiLabel className="text-xs font-medium text-muted-foreground">{label}</UiLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded border border-input bg-background p-0.5"
        />
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
      </div>
    </div>
  )
}

export { TextField, NumberField, ColorField }

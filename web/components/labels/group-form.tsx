'use client'

import { useTranslations } from 'next-intl'
import { TextField, NumberField, ColorField } from '@/components/labels/field-components'
import { Label as UiLabel } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { SELECTION_MODES, type GroupFormState } from '@/components/labels/labels-utils'

// ── GroupForm Sub-component ──

function GroupForm({
  form,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  form: GroupFormState
  onChange: (f: GroupFormState) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const t = useTranslations('labelsAdmin')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t('name')} value={form.name} onChange={(v) => onChange({ ...form, name: v })} placeholder={t('namePlaceholder')} />
        <TextField label={t('slug')} value={form.slug} onChange={(v) => onChange({ ...form, slug: v })} placeholder={t('slugPlaceholder')} />
        <ColorField label={t('color')} value={form.color} onChange={(v) => onChange({ ...form, color: v })} />
        <NumberField label={t('sortOrder')} value={form.sort_order} onChange={(v) => onChange({ ...form, sort_order: v })} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Selection mode */}
        <div className="flex flex-col gap-1.5">
          <UiLabel className="text-xs font-medium text-muted-foreground">{t('selectionMode')}</UiLabel>
          <Select
            value={form.selection_mode}
            onValueChange={(value) =>
              onChange({ ...form, selection_mode: value as 'single' | 'multi' })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTION_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {t(m.value === 'single' ? 'single' : 'multi')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Required checkbox */}
        <label className="flex items-center gap-2 pt-4">
          <Checkbox
            checked={form.required}
            onCheckedChange={(checked) => onChange({ ...form, required: checked })}
          />
          <span className="text-sm">{t('required')}</span>
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !form.name || !form.slug}
        >
          {saving ? t('saving') : t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}

export { GroupForm }

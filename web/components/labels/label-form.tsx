'use client'

import { useTranslations } from 'next-intl'
import { TextField, NumberField, ColorField } from '@/components/labels/field-components'
import { Button } from '@/components/ui/button'
import type { LabelFormState } from '@/components/labels/labels-utils'

// ── LabelForm Sub-component ──

function LabelForm({
  form,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  form: LabelFormState
  onChange: (f: LabelFormState) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const t = useTranslations('labelsAdmin')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label={t('name')} value={form.name} onChange={(v) => onChange({ ...form, name: v })} placeholder={t('namePlaceholder')} />
        <TextField label={t('slug')} value={form.slug} onChange={(v) => onChange({ ...form, slug: v })} placeholder={t('slugPlaceholder')} />
        <ColorField label={t('color')} value={form.color} onChange={(v) => onChange({ ...form, color: v })} />
        <NumberField label={t('sortOrder')} value={form.sort_order} onChange={(v) => onChange({ ...form, sort_order: v })} />
      </div>

      <div className="flex items-center gap-2">
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

export { LabelForm }

'use client'

import { useState } from 'react'
import { useLabels } from '@/hooks/useLabels'
import { api, defaultGroup, defaultLabel } from '@/components/labels/labels-utils'
import type { LabelGroup, Label } from '@/hooks/useLabels'

// ── useLabelAdmin ──

export function useLabelAdmin() {
  const { groups, loading, error, refetch } = useLabels()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingGroup, setAddingGroup] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [addingLabelForGroup, setAddingLabelForGroup] = useState<string | null>(null)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'group' | 'label'
    id: string
    name: string
  } | null>(null)

  const [groupForm, setGroupForm] = useState(defaultGroup())
  const [labelForm, setLabelForm] = useState(defaultLabel())

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const resetGroupForm = () => setGroupForm(defaultGroup())
  const resetLabelForm = () => setLabelForm(defaultLabel())

  const startEditGroup = (group: LabelGroup) => {
    setEditingGroupId(group.id)
    setAddingGroup(false)
    setGroupForm({
      name: group.name,
      slug: group.slug,
      color: group.color,
      sort_order: group.sort_order,
      selection_mode: group.selection_mode,
      required: group.required,
      labels: [],
    })
  }

  const startEditLabel = (label: Label) => {
    setEditingLabelId(label.id)
    setAddingLabelForGroup(null)
    setLabelForm({
      name: label.name,
      slug: label.slug,
      color: label.color,
      sort_order: label.sort_order,
    })
  }

  // ── Save group ──
  const handleSaveGroup = async (id?: string) => {
    setSaving(true)
    setApiError(null)
    try {
      if (id) {
        const res = await api(`/api/labels/groups/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(groupForm),
        })
        if (res.error) { setApiError(res.error); return }
      } else {
        const res = await api('/api/labels/groups', {
          method: 'POST',
          body: JSON.stringify(groupForm),
        })
        if (res.error) { setApiError(res.error); return }
      }
      setEditingGroupId(null)
      setAddingGroup(false)
      resetGroupForm()
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete group ──
  const handleDeleteGroup = async (id: string) => {
    setSaving(true)
    setApiError(null)
    try {
      const res = await api(`/api/labels/groups/${id}`, { method: 'DELETE' })
      if (res.error) { setApiError(res.error); return }
      setConfirmDelete(null)
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  // ── Save label ──
  const handleSaveLabel = async (id: string | undefined, groupId: string) => {
    setSaving(true)
    setApiError(null)
    try {
      if (id) {
        const res = await api(`/api/labels/items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(labelForm),
        })
        if (res.error) { setApiError(res.error); return }
      } else {
        const res = await api('/api/labels/items', {
          method: 'POST',
          body: JSON.stringify({ ...labelForm, group_id: groupId }),
        })
        if (res.error) { setApiError(res.error); return }
      }
      setEditingLabelId(null)
      setAddingLabelForGroup(null)
      resetLabelForm()
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete label ──
  const handleDeleteLabel = async (id: string) => {
    setSaving(true)
    setApiError(null)
    try {
      const res = await api(`/api/labels/items/${id}`, { method: 'DELETE' })
      if (res.error) { setApiError(res.error); return }
      setConfirmDelete(null)
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  return {
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
  }
}
import type { LabelGroup, Label } from '@/hooks/useLabels'

// ── Types ──

export type GroupFormState = Omit<LabelGroup, 'id' | 'labels'> & {
  labels: Omit<Label, 'id' | 'group_id'>[]
}

export type LabelFormState = Omit<Label, 'id' | 'group_id'>

// ── API helper ──

export async function api<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    return (await res.json()) as { data?: T; error?: string }
  } catch {
    return { error: 'Network error' }
  }
}

// ── Defaults ──

export function defaultGroup(): GroupFormState {
  return {
    name: '',
    slug: '',
    color: '#3b82f6',
    sort_order: 0,
    selection_mode: 'single',
    required: false,
    labels: [],
  }
}

export function defaultLabel(): LabelFormState {
  return { name: '', slug: '', color: '#6366f1', sort_order: 0 }
}

// ── Constants ──

export const SELECTION_MODES: { value: 'single' | 'multi' }[] = [
  { value: 'single' },
  { value: 'multi' },
]
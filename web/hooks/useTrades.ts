'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TradeTemplate, TradeType, TradeField } from '@/types/database'

/**
 * Hook to load trade-specific templates with their field definitions.
 */
export function useTrades() {
  const [templates, setTemplates] = useState<TradeTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('trade_templates')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) {
          setTemplates(data as unknown as TradeTemplate[])
        }
        setIsLoading(false)
      })
  }, [])

  const getTemplate = useCallback(
    (trade: TradeType) => templates.find(t => t.trade === trade) ?? null,
    [templates]
  )

  const getLabel = useCallback(
    (trade: TradeType, locale: string = 'en') => {
      const t = getTemplate(trade)
      if (!t) return trade
      return (t.label as Record<string, string>)[locale] ?? trade
    },
    [getTemplate]
  )

  const getFields = useCallback(
    (trade: TradeType): TradeField[] => {
      const t = getTemplate(trade)
      return t ? (t.fields as TradeField[]) : []
    },
    [getTemplate]
  )

  return { templates, isLoading, getTemplate, getLabel, getFields }
}

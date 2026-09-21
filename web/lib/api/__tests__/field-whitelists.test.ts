import { describe, it, expect } from 'vitest'
import {
  DAILY_LOG_UPDATE_FIELDS,
  PIN_UPDATE_FIELDS,
  filterAllowedFields,
} from '../field-whitelists'

describe('filterAllowedFields (P1-9 mass-assignment mitigation)', () => {
  it('keeps only whitelisted fields', () => {
    const result = filterAllowedFields(
      { log_date: '2026-08-04', user_id: 'u-1', project_id: 'p-1', weather: 'sunny' },
      DAILY_LOG_UPDATE_FIELDS,
    )
    expect(result).toEqual({ log_date: '2026-08-04', weather: 'sunny' })
  })

  it('drops sensitive columns from pins updates', () => {
    const result = filterAllowedFields(
      { color: 'red', x: 10, y: 20, user_id: 'u-1', photo_id: 'ph-1', created_at: 'now' },
      PIN_UPDATE_FIELDS,
    )
    expect(result).toEqual({ color: 'red', x: 10, y: 20 })
    expect(result.user_id).toBeUndefined()
    expect(result.photo_id).toBeUndefined()
    expect(result.created_at).toBeUndefined()
  })

  it('returns {} when nothing is whitelisted', () => {
    expect(filterAllowedFields({ user_id: 'u-1', project_id: 'p-1' }, PIN_UPDATE_FIELDS)).toEqual({})
  })

  it('returns {} for empty input', () => {
    expect(filterAllowedFields({}, DAILY_LOG_UPDATE_FIELDS)).toEqual({})
  })

  it('keeps explicit undefined values out of the result', () => {
    expect(filterAllowedFields({ log_date: undefined, weather: 'rain' }, DAILY_LOG_UPDATE_FIELDS))
      .toEqual({ weather: 'rain' })
  })

  it('exposes only the documented daily-log fields', () => {
    expect([...DAILY_LOG_UPDATE_FIELDS]).toEqual([
      'log_date',
      'work_description',
      'weather',
      'temperature',
      'notes',
    ])
  })

  it('exposes only the documented pin fields', () => {
    expect([...PIN_UPDATE_FIELDS]).toEqual([
      'pin_type',
      'x',
      'y',
      'width',
      'height',
      'color',
      'label',
      'drawing_data',
    ])
  })
})

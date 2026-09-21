import { describe, expect, it } from 'vitest'
import { climateSummary, parseTemperature } from '@/lib/weather-summary'
import type { DailyLog } from '@/types/database'

function makeLog(date: string, weather: string | null, temperature: string | null): DailyLog {
  return {
    id: date,
    project_id: 'p1',
    user_id: 'u1',
    log_date: date,
    weather,
    temperature,
    work_description: 'Work',
    notes: null,
    created_at: `${date}T08:00:00.000Z`,
    updated_at: `${date}T08:00:00.000Z`,
  }
}

describe('parseTemperature', () => {
  it('parses "23°C" style values', () => {
    expect(parseTemperature('23°C')).toBe(23)
    expect(parseTemperature('23 C')).toBe(23)
  })

  it('parses plain numbers and negatives', () => {
    expect(parseTemperature('23')).toBe(23)
    expect(parseTemperature('-2°C')).toBe(-2)
  })

  it('parses decimals', () => {
    expect(parseTemperature('21.5°C')).toBe(21.5)
  })

  it('returns null for missing or non-numeric values', () => {
    expect(parseTemperature(null)).toBeNull()
    expect(parseTemperature('')).toBeNull()
    expect(parseTemperature('warm')).toBeNull()
  })
})

describe('climateSummary', () => {
  it('sorts days chronologically', () => {
    const logs = [
      makeLog('2026-07-03', 'rain', '18°C'),
      makeLog('2026-07-01', 'sunny', '25°C'),
      makeLog('2026-07-02', 'cloudy', '20°C'),
    ]
    const summary = climateSummary(logs)
    expect(summary.days.map((d) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
  })

  it('computes avg/min/max temperature', () => {
    const logs = [
      makeLog('2026-07-01', 'sunny', '20°C'),
      makeLog('2026-07-02', 'sunny', '30°C'),
      makeLog('2026-07-03', 'sunny', '25°C'),
    ]
    const summary = climateSummary(logs)
    expect(summary.avgTemp).toBe(25)
    expect(summary.minTemp).toBe(20)
    expect(summary.maxTemp).toBe(30)
  })

  it('ignores days without temperature', () => {
    const logs = [
      makeLog('2026-07-01', 'sunny', '20°C'),
      makeLog('2026-07-02', 'rain', null),
    ]
    const summary = climateSummary(logs)
    expect(summary.avgTemp).toBe(20)
    expect(summary.minTemp).toBe(20)
    expect(summary.maxTemp).toBe(20)
  })

  it('returns null stats when no temperatures exist', () => {
    const logs = [makeLog('2026-07-01', 'rain', null)]
    const summary = climateSummary(logs)
    expect(summary.avgTemp).toBeNull()
    expect(summary.minTemp).toBeNull()
    expect(summary.maxTemp).toBeNull()
  })

  it('tallies weather counts case-insensitively', () => {
    const logs = [
      makeLog('2026-07-01', 'Sunny', '20°C'),
      makeLog('2026-07-02', 'sunny', '22°C'),
      makeLog('2026-07-03', 'Rain', '18°C'),
    ]
    const summary = climateSummary(logs)
    expect(summary.weatherCounts).toEqual({ sunny: 2, rain: 1 })
  })

  it('normalizes weather values to lowercase', () => {
    const logs = [makeLog('2026-07-01', 'Sunny', '20°C')]
    const summary = climateSummary(logs)
    expect(summary.days[0].weather).toBe('sunny')
  })
})

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TZ,
  projectTz,
  dayKeyInTz,
  todayStartInTz,
  addDays,
  diffCalendarDays,
} from '../time'

describe('projectTz', () => {
  it('defaults to UTC when nothing is provided', () => {
    expect(projectTz()).toBe(DEFAULT_TZ)
    expect(projectTz(null, null)).toBe(DEFAULT_TZ)
  })

  it('prefers the project timezone', () => {
    expect(projectTz({ timezone: 'America/New_York' })).toBe('America/New_York')
    expect(
      projectTz(
        { timezone: 'America/New_York' },
        { timezone: 'Europe/Skopje' },
      ),
    ).toBe('America/New_York')
  })

  it('falls back to the company timezone when the project has none', () => {
    expect(projectTz({ timezone: null }, { timezone: 'Europe/Skopje' })).toBe(
      'Europe/Skopje',
    )
    expect(projectTz(null, { timezone: 'Europe/Skopje' })).toBe('Europe/Skopje')
  })

  it('falls back to UTC when both are missing', () => {
    expect(projectTz({ timezone: null })).toBe(DEFAULT_TZ)
  })
})

describe('dayKeyInTz', () => {
  it('returns the UTC day key for the UTC timezone', () => {
    expect(dayKeyInTz('2026-08-04T23:30:00.000Z', 'UTC')).toBe('2026-08-04')
  })

  it('maps an instant to the correct day in a negative-offset zone', () => {
    // 01:30 UTC on Aug 5 is still Aug 4 in New York (EDT = UTC-4).
    expect(dayKeyInTz('2026-08-05T01:30:00.000Z', 'America/New_York')).toBe(
      '2026-08-04',
    )
  })

  it('maps an instant to the correct day in a positive-offset zone', () => {
    // 23:30 UTC on Aug 4 is already Aug 5 in Skopje (CEST = UTC+2).
    expect(dayKeyInTz('2026-08-04T23:30:00.000Z', 'Europe/Skopje')).toBe(
      '2026-08-05',
    )
  })

  it('keeps the same day across a spring-forward DST transition', () => {
    // 2026-03-08 06:00 UTC = 01:00 EST (before the 02:00->03:00 jump).
    expect(dayKeyInTz('2026-03-08T06:00:00.000Z', 'America/New_York')).toBe(
      '2026-03-08',
    )
    // 2026-03-08 12:00 UTC = 08:00 EDT (after the jump).
    expect(dayKeyInTz('2026-03-08T12:00:00.000Z', 'America/New_York')).toBe(
      '2026-03-08',
    )
  })
})

describe('todayStartInTz', () => {
  it('returns midnight UTC for the UTC timezone', () => {
    expect(
      todayStartInTz('UTC', new Date('2026-08-04T12:00:00.000Z')),
    ).toEqual(new Date('2026-08-04T00:00:00.000Z'))
  })

  it('returns the local midnight instant in a negative-offset zone', () => {
    // Midnight EDT (UTC-4) on Aug 4 = 04:00 UTC.
    expect(
      todayStartInTz('America/New_York', new Date('2026-08-04T12:00:00.000Z')),
    ).toEqual(new Date('2026-08-04T04:00:00.000Z'))
  })

  it('returns the local midnight instant in a positive-offset zone', () => {
    // Midnight CEST (UTC+2) on Aug 4 = 22:00 UTC on Aug 3.
    expect(
      todayStartInTz('Europe/Skopje', new Date('2026-08-04T12:00:00.000Z')),
    ).toEqual(new Date('2026-08-03T22:00:00.000Z'))
  })

  it('defaults to now when no instant is given', () => {
    const start = todayStartInTz('UTC')
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
    expect(start.getUTCSeconds()).toBe(0)
  })
})

describe('addDays', () => {
  it('adds calendar days preserving wall-clock time', () => {
    expect(
      addDays('UTC', new Date('2026-08-04T12:00:00.000Z'), 1),
    ).toEqual(new Date('2026-08-05T12:00:00.000Z'))
  })

  it('subtracts days', () => {
    expect(
      addDays('UTC', new Date('2026-08-04T12:00:00.000Z'), -3),
    ).toEqual(new Date('2026-08-01T12:00:00.000Z'))
  })

  it('is DST-safe across a spring-forward transition', () => {
    // 2026-03-07 12:00 UTC = 07:00 EST. +1 calendar day = 07:00 EDT on Mar 8
    // = 11:00 UTC (23-hour day, NOT 12:00 UTC).
    expect(
      addDays('America/New_York', new Date('2026-03-07T12:00:00.000Z'), 1),
    ).toEqual(new Date('2026-03-08T11:00:00.000Z'))
  })

  it('is DST-safe across a fall-back transition', () => {
    // 2026-10-31 12:00 UTC = 08:00 EDT. +1 calendar day = 08:00 EST on Nov 1
    // = 13:00 UTC (25-hour day).
    expect(
      addDays('America/New_York', new Date('2026-10-31T12:00:00.000Z'), 1),
    ).toEqual(new Date('2026-11-01T13:00:00.000Z'))
  })
})

describe('diffCalendarDays', () => {
  it('returns 0 for the same instant', () => {
    expect(
      diffCalendarDays('UTC', new Date('2026-08-04T12:00:00.000Z'), new Date('2026-08-04T12:00:00.000Z')),
    ).toBe(0)
  })

  it('counts whole calendar days in UTC', () => {
    expect(
      diffCalendarDays('UTC', new Date('2026-08-01T00:00:00.000Z'), new Date('2026-08-04T00:00:00.000Z')),
    ).toBe(3)
  })

  it('is DST-safe across a spring-forward transition (23-hour day)', () => {
    expect(
      diffCalendarDays(
        'America/New_York',
        new Date('2026-03-07T12:00:00.000Z'),
        new Date('2026-03-08T12:00:00.000Z'),
      ),
    ).toBe(1)
  })

  it('is DST-safe across a fall-back transition (25-hour day)', () => {
    expect(
      diffCalendarDays(
        'America/New_York',
        new Date('2026-10-31T12:00:00.000Z'),
        new Date('2026-11-01T12:00:00.000Z'),
      ),
    ).toBe(1)
  })

  it('is DST-safe in Europe/Skopje across the spring transition', () => {
    // 2026-03-28 12:00 UTC = 13:00 CET. 2026-03-29 12:00 UTC = 14:00 CEST.
    expect(
      diffCalendarDays(
        'Europe/Skopje',
        new Date('2026-03-28T12:00:00.000Z'),
        new Date('2026-03-29T12:00:00.000Z'),
      ),
    ).toBe(1)
  })

  it('returns a negative count when b precedes a', () => {
    expect(
      diffCalendarDays('UTC', new Date('2026-08-04T00:00:00.000Z'), new Date('2026-08-01T00:00:00.000Z')),
    ).toBe(-3)
  })
})
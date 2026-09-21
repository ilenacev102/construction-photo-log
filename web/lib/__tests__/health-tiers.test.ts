import { describe, expect, it } from 'vitest'
import { healthScoreFor, healthTierFor } from '@/lib/health-tiers'

describe('healthScoreFor edge cases & invariants', () => {
  it('returns 100 for 0 open and 0 inProgress', () => {
    expect(healthScoreFor(0, 0)).toBe(100)
  })

  it('correctly weighs open (8) and in-progress (4)', () => {
    expect(healthScoreFor(1, 0)).toBe(92)
    expect(healthScoreFor(0, 1)).toBe(96)
    expect(healthScoreFor(2, 3)).toBe(100 - 16 - 12)
  })

  it('clamps to 0 when defects exceed 100 penalty', () => {
    expect(healthScoreFor(15, 10)).toBe(0)
    expect(healthScoreFor(1000, 500)).toBe(0)
  })

  it('handles negative inputs safely by treating them as 0', () => {
    expect(healthScoreFor(-5, -10)).toBe(100)
    expect(healthScoreFor(-5, 2)).toBe(92)
  })

  it('handles NaN and Infinity safely', () => {
    expect(healthScoreFor(NaN, 0)).toBe(100)
    expect(healthScoreFor(0, NaN)).toBe(100)
    expect(healthScoreFor(Infinity, 0)).toBe(0)
  })
})

describe('healthTierFor boundaries', () => {
  it('returns healthy for score >= 75', () => {
    expect(healthTierFor(100)).toBe('healthy')
    expect(healthTierFor(75)).toBe('healthy')
    expect(healthTierFor(75.5)).toBe('healthy')
  })

  it('returns atRisk for 45 <= score < 75', () => {
    expect(healthTierFor(74.9)).toBe('atRisk')
    expect(healthTierFor(74)).toBe('atRisk')
    expect(healthTierFor(45)).toBe('atRisk')
  })

  it('returns critical for score < 45', () => {
    expect(healthTierFor(44.9)).toBe('critical')
    expect(healthTierFor(44)).toBe('critical')
    expect(healthTierFor(0)).toBe('critical')
    expect(healthTierFor(-10)).toBe('critical')
  })
})

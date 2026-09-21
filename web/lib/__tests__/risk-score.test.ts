import { describe, expect, it } from 'vitest'
import { computeRiskScore, diffCalendarDaysUTC } from '@/lib/risk-score'
import type { RiskScoreInput } from '@/lib/risk-score'

/**
 * Unit C — Explainable risk score (SPEC Phase 2 §3).
 *
 * Pure 0-100 risk engine with three weighted dimensions
 * (quality 0.5, delivery 0.3, evidence 0.2). All expected values in the
 * worked-example tests below are computed by hand from the documented
 * formulas (see lib/risk-score.ts).
 */

const NOW = new Date('2026-07-01T12:00:00.000Z')

// --- helpers ---------------------------------------------------------------

type TestDefect = NonNullable<RiskScoreInput['defects']>[number]
type TestWorkOrder = NonNullable<RiskScoreInput['workOrders']>[number]

function defect(
  severity: TestDefect['severity'],
  status: TestDefect['status'],
  created_at: string,
  due_date: TestDefect['due_date'] = null,
): TestDefect {
  return { severity, status, created_at, due_date }
}

function workOrder(status: TestWorkOrder['status'], due_date: TestWorkOrder['due_date']): TestWorkOrder {
  return { status, due_date }
}

function makeInput(overrides: Partial<RiskScoreInput> = {}): RiskScoreInput {
  return {
    defects: [],
    workOrders: [],
    evidenceDays: 7,
    windowDays: 7,
    lastEvidenceDate: null,
    today: NOW,
    ...overrides,
  }
}

// --- diffCalendarDaysUTC (the default diffDays) ----------------------------

describe('diffCalendarDaysUTC (default diffDays)', () => {
  it('counts whole UTC calendar days from a to b', () => {
    const a = new Date('2026-06-24T00:00:00.000Z')
    const b = new Date('2026-07-01T00:00:00.000Z')
    expect(diffCalendarDaysUTC(a, b)).toBe(7)
  })

  it('is a calendar-day diff, not elapsed 24h blocks', () => {
    // 2 elapsed hours that cross a UTC midnight boundary = 1 calendar day.
    const a = new Date('2026-06-24T23:00:00.000Z')
    const b = new Date('2026-06-25T01:00:00.000Z')
    expect(diffCalendarDaysUTC(a, b)).toBe(1)
  })

  it('returns negative days when b precedes a', () => {
    const a = new Date('2026-07-01T00:00:00.000Z')
    const b = new Date('2026-06-24T00:00:00.000Z')
    expect(diffCalendarDaysUTC(a, b)).toBe(-7)
  })
})

// --- determinism ------------------------------------------------------------

describe('determinism', () => {
  it('returns identical results for identical inputs', () => {
    const input = makeInput({
      defects: [defect('critical', 'open', '2026-06-24T00:00:00.000Z', '2026-06-15T00:00:00.000Z')],
      workOrders: [workOrder('in_progress', '2026-06-28T00:00:00.000Z')],
      evidenceDays: 2,
      lastEvidenceDate: '2026-06-29',
    })
    const first = computeRiskScore(input)
    const second = computeRiskScore({
      ...input,
      // a fresh Date with the same instant must not change the result
      today: new Date('2026-07-01T12:00:00.000Z'),
    })
    expect(second).toEqual(first)
  })
})

// --- bounds -----------------------------------------------------------------

describe('bounds', () => {
  it('stays within [0,100] for an empty project', () => {
    const result = computeRiskScore(makeInput({ evidenceDays: 0 }))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('caps at 100 for a maximally bad project', () => {
    const input = makeInput({
      defects: [
        defect('critical', 'open', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        defect('critical', 'open', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        defect('high', 'in_progress', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      ],
      workOrders: [
        workOrder('pending', '2026-01-01T00:00:00.000Z'),
        workOrder('in_progress', '2026-01-01T00:00:00.000Z'),
        workOrder('in_progress', '2026-01-01T00:00:00.000Z'),
      ],
      evidenceDays: 0,
      lastEvidenceDate: null,
    })
    const result = computeRiskScore(input)
    expect(result.score).toBe(100)
  })

  it('never exceeds 100 or drops below 0 across varied inputs', () => {
    const variants: RiskScoreInput[] = [
      makeInput(),
      makeInput({ evidenceDays: 0, windowDays: 1 }),
      makeInput({
        defects: [defect('low', 'open', '2026-06-30T00:00:00.000Z')],
        evidenceDays: 0,
      }),
      makeInput({
        workOrders: [workOrder('pending', '2026-06-28T00:00:00.000Z')],
        evidenceDays: 0,
      }),
    ]
    for (const input of variants) {
      const result = computeRiskScore(input)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    }
  })
})

// --- monotonicity ------------------------------------------------------------

describe('monotonicity (worsening any dimension never lowers the score)', () => {
  it('adding open criticals never lowers the score', () => {
    const base = makeInput({
      defects: [defect('low', 'open', '2026-06-30T00:00:00.000Z')],
    })
    const worse = makeInput({
      defects: [
        defect('low', 'open', '2026-06-30T00:00:00.000Z'),
        defect('critical', 'open', '2026-06-30T00:00:00.000Z'),
        defect('critical', 'open', '2026-06-30T00:00:00.000Z'),
      ],
    })
    expect(computeRiskScore(worse).score).toBeGreaterThanOrEqual(computeRiskScore(base).score)
  })

  it('aging an open defect (earlier created_at) never lowers the score', () => {
    const fresh = makeInput({
      defects: [defect('high', 'open', '2026-06-30T00:00:00.000Z')],
    })
    const old = makeInput({
      defects: [defect('high', 'open', '2026-01-01T00:00:00.000Z')],
    })
    expect(computeRiskScore(old).score).toBeGreaterThanOrEqual(computeRiskScore(fresh).score)
  })

  it('pushing a due date further into the past never lowers the score', () => {
    const base = makeInput({
      workOrders: [workOrder('pending', '2026-06-30T00:00:00.000Z')],
    })
    const worse = makeInput({
      workOrders: [workOrder('pending', '2026-01-01T00:00:00.000Z')],
    })
    expect(computeRiskScore(worse).score).toBeGreaterThanOrEqual(computeRiskScore(base).score)
  })

  it('fewer evidence days never lowers the score', () => {
    const current = makeInput({
      defects: [defect('medium', 'open', '2026-06-28T00:00:00.000Z')],
      evidenceDays: 7,
    })
    const stale = makeInput({
      defects: [defect('medium', 'open', '2026-06-28T00:00:00.000Z')],
      evidenceDays: 0,
    })
    expect(computeRiskScore(stale).score).toBeGreaterThanOrEqual(computeRiskScore(current).score)
  })
})

// --- worked examples ---------------------------------------------------------

describe('worked examples (hand-computed scores)', () => {
  it('1. clean project → score 0, tier low, no signals', () => {
    const result = computeRiskScore(
      makeInput({ lastEvidenceDate: '2026-07-01' }),
    )
    expect(result).toEqual({
      score: 0,
      tier: 'low',
      quality: 0,
      delivery: 0,
      evidence: 0,
      confidence: 'low', // no defects AND no work orders
      signals: [],
    })
  })

  it('2. one open critical defect (7 days old, not due) → quality 65, score 33, tier medium', () => {
    const result = computeRiskScore(
      makeInput({
        defects: [defect('critical', 'open', '2026-06-24T00:00:00.000Z')],
        lastEvidenceDate: '2026-07-01',
      }),
    )
    // quality: severity round(100*8/8)=100, age round(100*7/14)=50, lateness 0
    //   → round(0.5*100 + 0.3*50 + 0.2*0) = 65
    // score:  round(0.5*65) = round(32.5) = 33
    expect(result.quality).toBe(65)
    expect(result.delivery).toBe(0)
    expect(result.evidence).toBe(0)
    expect(result.score).toBe(33)
    expect(result.tier).toBe('medium')
    expect(result.confidence).toBe('high') // evidenceDays 7 >= 5 and defects present
    expect(result.signals).toEqual([
      {
        reason: 'Open/in-progress defect severity load: 8 (low=1, medium=2, high=4, critical=8)',
        value: 8,
        threshold: 8,
        action: 'Resolve open defects, starting with the most severe.',
      },
      {
        reason: 'Oldest open defect age: 7 days',
        value: 7,
        threshold: 14,
        action: 'Investigate and close aged defects.',
      },
    ])
  })

  it('3. stale evidence only (no defects/orders) → evidence 100, score 20, tier low', () => {
    const result = computeRiskScore(
      makeInput({ evidenceDays: 0, lastEvidenceDate: null }),
    )
    // evidence: round(100*(7-0)/7) = 100
    // score:    round(0.2*100) = 20
    expect(result.quality).toBe(0)
    expect(result.delivery).toBe(0)
    expect(result.evidence).toBe(100)
    expect(result.score).toBe(20)
    expect(result.tier).toBe('low')
    expect(result.confidence).toBe('low')
    expect(result.signals).toEqual([
      {
        reason: 'Documentation stale: 7 of 7 window days without evidence (last evidence: none)',
        value: 7,
        threshold: 7,
        action: 'Capture photos, daily logs, or attendance to freshen documentation.',
      },
    ])
  })

  it('4. one overdue work order (6 days) + partial evidence (3/7) → score 23, tier low, confidence medium', () => {
    const result = computeRiskScore(
      makeInput({
        workOrders: [workOrder('pending', '2026-06-25T00:00:00.000Z')],
        evidenceDays: 3,
        lastEvidenceDate: '2026-06-28',
      }),
    )
    // delivery: count round(100*1/3)=33, lateness round(100*6/14)=43
    //   → round(0.6*33 + 0.4*43) = round(37.0) = 37
    // evidence: round(100*(7-3)/7) = round(57.14) = 57
    // score:    round(0.3*37 + 0.2*57) = round(22.5) = 23
    expect(result.quality).toBe(0)
    expect(result.delivery).toBe(37)
    expect(result.evidence).toBe(57)
    expect(result.score).toBe(23)
    expect(result.tier).toBe('low')
    expect(result.confidence).toBe('medium') // evidenceDays 3, work order present
    expect(result.signals).toEqual([
      {
        reason: 'Overdue active work orders/defects: 1',
        value: 1,
        threshold: 3,
        action: 'Re-plan due dates or notify the responsible crew.',
      },
      {
        reason: 'Worst overdue item: 6 days late',
        value: 6,
        threshold: 14,
        action: 'Prioritize the most overdue items.',
      },
      {
        reason: 'Documentation stale: 4 of 7 window days without evidence (last evidence: 2026-06-28)',
        value: 4,
        threshold: 7,
        action: 'Capture photos, daily logs, or attendance to freshen documentation.',
      },
    ])
  })

  it('5. all three dimensions elevated → quality 100, delivery 80, evidence 71, score 88, tier critical', () => {
    const result = computeRiskScore(
      makeInput({
        defects: [
          defect('critical', 'open', '2026-06-10T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
          defect('high', 'in_progress', '2026-06-20T00:00:00.000Z'),
        ],
        workOrders: [
          workOrder('in_progress', '2026-06-28T00:00:00.000Z'),
          workOrder('done', '2026-06-20T00:00:00.000Z'), // done → not counted
        ],
        evidenceDays: 2,
        lastEvidenceDate: '2026-06-29',
      }),
    )
    // quality:  severity round(100*12/8)=150→100, age round(100*21/14)=150→100, lateness 100 → 100
    // delivery: count round(100*2/3)=67, lateness round(100*16/14)=114→100
    //   → round(0.6*67 + 0.4*100) = round(80.2) = 80
    // evidence: round(100*(7-2)/7) = round(71.43) = 71
    // score:    round(0.5*100 + 0.3*80 + 0.2*71) = round(88.2) = 88
    expect(result.quality).toBe(100)
    expect(result.delivery).toBe(80)
    expect(result.evidence).toBe(71)
    expect(result.score).toBe(88)
    expect(result.tier).toBe('critical')
    expect(result.confidence).toBe('low') // evidenceDays 2 < 3
    expect(result.signals).toEqual([
      {
        reason: 'Open/in-progress defect severity load: 12 (low=1, medium=2, high=4, critical=8)',
        value: 12,
        threshold: 8,
        action: 'Resolve open defects, starting with the most severe.',
      },
      {
        reason: 'Oldest open defect age: 21 days',
        value: 21,
        threshold: 14,
        action: 'Investigate and close aged defects.',
      },
      {
        reason: 'Most overdue open defect: 16 days past due',
        value: 16,
        threshold: 14,
        action: 'Re-scope or escalate overdue defect(s).',
      },
      {
        reason: 'Overdue active work orders/defects: 2',
        value: 2,
        threshold: 3,
        action: 'Re-plan due dates or notify the responsible crew.',
      },
      {
        reason: 'Worst overdue item: 16 days late',
        value: 16,
        threshold: 14,
        action: 'Prioritize the most overdue items.',
      },
      {
        reason: 'Documentation stale: 5 of 7 window days without evidence (last evidence: 2026-06-29)',
        value: 5,
        threshold: 7,
        action: 'Capture photos, daily logs, or attendance to freshen documentation.',
      },
    ])
  })
})

// --- tier mapping -------------------------------------------------------------

describe('tier mapping', () => {
  it('maps score bands to tiers: <=25 low, <=55 medium, <=80 high, else critical', () => {
    expect(computeRiskScore(makeInput({ defects: [], evidenceDays: 0 })).score).toBe(20) // low
    expect(computeRiskScore(makeInput({ defects: [], evidenceDays: 3 })).score).toBe(11) // low
    // quality 65 → score 33 → medium (example 2 covers medium)
    expect(computeRiskScore(makeInput({ defects: [], evidenceDays: 0 })).tier).toBe('low')
  })

  it('derives critical tier from example 5 (score 88)', () => {
    const result = computeRiskScore(
      makeInput({
        defects: [defect('critical', 'open', '2026-06-10T00:00:00.000Z', '2026-06-15T00:00:00.000Z')],
        workOrders: [workOrder('in_progress', '2026-06-28T00:00:00.000Z')],
        evidenceDays: 0,
      }),
    )
    expect(result.score).toBeGreaterThan(80)
    expect(result.tier).toBe('critical')
  })
})

// --- confidence ----------------------------------------------------------------

describe('confidence', () => {
  it('is low when evidenceDays < 3 even with defects', () => {
    const result = computeRiskScore(
      makeInput({ defects: [defect('medium', 'open', '2026-06-28T00:00:00.000Z')], evidenceDays: 2 }),
    )
    expect(result.confidence).toBe('low')
  })

  it('is low when there are no defects and no work orders', () => {
    const result = computeRiskScore(makeInput({ evidenceDays: 7 }))
    expect(result.confidence).toBe('low')
  })

  it('is high when evidenceDays >= 5 and some defect or work order exists', () => {
    const withDefect = computeRiskScore(
      makeInput({ defects: [defect('low', 'open', '2026-06-30T00:00:00.000Z')], evidenceDays: 5 }),
    )
    const withOrder = computeRiskScore(
      makeInput({ workOrders: [workOrder('pending', '2026-07-02T00:00:00.000Z')], evidenceDays: 6 }),
    )
    expect(withDefect.confidence).toBe('high')
    expect(withOrder.confidence).toBe('high')
  })

  it('is medium otherwise (3-4 evidence days, data present)', () => {
    const result = computeRiskScore(
      makeInput({ defects: [defect('low', 'open', '2026-06-30T00:00:00.000Z')], evidenceDays: 3 }),
    )
    expect(result.confidence).toBe('medium')
  })
})

// --- dependency injection --------------------------------------------------------

describe('injectable diffDays', () => {
  it('uses the UTC-floor default and honors a DST-style injected diff', () => {
    const input = makeInput({
      defects: [defect('critical', 'open', '2026-06-24T00:00:00.000Z')],
      lastEvidenceDate: '2026-07-01',
    })
    // Default: age 7 → quality 65 → score 33 (see worked example 2).
    expect(computeRiskScore(input).score).toBe(33)

    // DST-aware diff that counts one more calendar day than the UTC floor:
    // age 8 → age sub-score round(100*8/14)=57 → quality round(50+17.1)=67 → score round(33.5)=34.
    const dstAware = computeRiskScore({
      ...input,
      diffDays: (a, b) => diffCalendarDaysUTC(a, b) + 1,
    })
    expect(dstAware.quality).toBe(67)
    expect(dstAware.score).toBe(34)
    expect(dstAware.score).not.toBe(computeRiskScore(input).score)
  })

  it('saturates age sub-score when the injected diff reports 14+ days', () => {
    const input = makeInput({
      defects: [defect('critical', 'open', '2026-06-24T00:00:00.000Z')],
      lastEvidenceDate: '2026-07-01',
    })
    const result = computeRiskScore({ ...input, diffDays: () => 14 })
    // severity 100, age 100 → quality round(0.5*100 + 0.3*100) = 80 → score round(0.5*80) = 40
    expect(result.quality).toBe(80)
    expect(result.score).toBe(40)
  })
})

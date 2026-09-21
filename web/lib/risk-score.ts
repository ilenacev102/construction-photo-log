/**
 * Explainable 0–100 project risk engine (SPEC Phase 2 §3 — Unit C).
 *
 * Pure, side-effect-free module: no network, no DB, no I/O. Every date
 * computation is a *calendar-day* diff injected via `diffDays` (default:
 * UTC-floor, so the module has zero runtime dependencies and is fully
 * deterministic). A DST-aware implementation (e.g. from `lib/time.ts`) can
 * be injected by consumers without changing this module.
 *
 * Three normalized 0–100 dimensions, aggregated by weighted sum:
 *   quality  × 0.5  (open-defect severity × age × lateness)
 *   delivery × 0.3  (overdue work orders & defects)
 *   evidence × 0.2  (stale documentation window)
 *
 * Each contributing driver also emits a `signals[]` entry so the score is
 * auditable: reason / current value / threshold / suggested action.
 */

export type RiskTier = 'low' | 'medium' | 'high' | 'critical'

export interface RiskSignal {
  reason: string
  value: number
  threshold: number
  action: string
}

export interface RiskScoreResult {
  score: number
  tier: RiskTier
  quality: number
  delivery: number
  evidence: number
  confidence: 'high' | 'medium' | 'low'
  signals: RiskSignal[]
}

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RiskDefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected'
export type RiskWorkOrderStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'

export interface RiskScoreInput {
  defects: Array<{
    severity: RiskSeverity
    status: RiskDefectStatus
    due_date: string | null
    created_at: string
  }>
  workOrders: Array<{
    status: RiskWorkOrderStatus
    due_date: string | null
  }>
  evidenceDays: number
  windowDays: number
  lastEvidenceDate: string | null
  today: Date
  diffDays?: (a: Date, b: Date) => number
}

// ---------------------------------------------------------------------------
// Constants (all documented so the formulas are auditable)
// ---------------------------------------------------------------------------

/** Weights of the three risk dimensions in the final score. */
const W_QUALITY = 0.5
const W_DELIVERY = 0.3
const W_EVIDENCE = 0.2

/** Severity weight per open defect (low=1, medium=2, high=4, critical=8). */
const SEVERITY_WEIGHT: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 8,
}

/**
 * quality = round(0.5·severityScore + 0.3·ageScore + 0.2·latenessScore).
 *
 * - severityScore = min(100, round(100·severityLoad / QUALITY_SEVERITY_CAP))
 *     severityLoad = Σ severityWeight over open/in-progress defects.
 *     CAP = 8 → one open critical (or e.g. four mediums) saturates this term.
 * - ageScore     = min(100, round(100·oldestAgeDays / QUALITY_AGE_CAP_DAYS))
 *     oldestAgeDays = days (via diffDays) since the oldest open defect's created_at.
 *     CAP = 14 → a defect open 14+ days saturates this term.
 * - latenessScore = min(100, round(100·maxOverdueDays / QUALITY_OVERDUE_CAP_DAYS))
 *     maxOverdueDays = days past due of the most overdue open defect (0 if none).
 *     CAP = 14 → a defect 14+ days past due saturates this term.
 */
const QUALITY_SEVERITY_CAP = 8
const QUALITY_AGE_CAP_DAYS = 14
const QUALITY_OVERDUE_CAP_DAYS = 14
const QUALITY_W_SEVERITY = 0.5
const QUALITY_W_AGE = 0.3
const QUALITY_W_LATENESS = 0.2

/**
 * delivery = round(0.6·countScore + 0.4·latenessScore).
 *
 * Overdue items = active work orders (pending/in_progress) whose due_date is
 * in the past, plus open/in-progress defects whose due_date is in the past.
 * - countScore    = min(100, round(100·overdueCount / OVERDUE_ITEM_CAP))
 *     CAP = 3 → three distinct overdue items saturate this term.
 * - latenessScore = min(100, round(100·maxDaysOverdue / OVERDUE_DAYS_CAP))
 *     CAP = 14 → an item 14+ days late saturates this term.
 */
const OVERDUE_ITEM_CAP = 3
const OVERDUE_DAYS_CAP = 14
const DELIVERY_W_COUNT = 0.6
const DELIVERY_W_LATENESS = 0.4

/** Confidence bands for the `confidence` field (see confidenceFor below). */
const CONFIDENCE_LOW_EVIDENCE_DAYS = 3
const CONFIDENCE_HIGH_EVIDENCE_DAYS = 5

/** Risk tier mapping: <=25 low, <=55 medium, <=80 high, else critical. */
const TIER_LOW_MAX = 25
const TIER_MEDIUM_MAX = 55
const TIER_HIGH_MAX = 80

const DAY_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/**
 * Default `diffDays`: whole UTC calendar days from `a` to `b` (i.e. b − a),
 * computed from UTC date components — NOT elapsed 24h blocks. Deterministic
 * and timezone-independent (zero runtime dependencies).
 */
export function diffCalendarDaysUTC(a: Date, b: Date): number {
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  return Math.round((bDay - aDay) / DAY_MS)
}

function parseDate(value: string | null): Date | null {
  if (value === null || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function ageDays(createdAt: string, today: Date, diffDays: (a: Date, b: Date) => number): number {
  const created = parseDate(createdAt)
  if (created === null) return 0
  return Math.max(0, diffDays(created, today))
}

function overdueDays(dueDate: string | null, today: Date, diffDays: (a: Date, b: Date) => number): number {
  const due = parseDate(dueDate)
  if (due === null) return 0
  return Math.max(0, diffDays(due, today))
}

function isActiveDefect(status: RiskDefectStatus): boolean {
  return status === 'open' || status === 'in_progress'
}

function isActiveWorkOrder(status: RiskWorkOrderStatus): boolean {
  return status === 'pending' || status === 'in_progress'
}

// ---------------------------------------------------------------------------
// Dimension builders
// ---------------------------------------------------------------------------

interface QualityResult {
  quality: number
  severityLoad: number
  oldestAge: number
  maxOverdue: number
  activeCount: number
}

function computeQuality(
  defects: RiskScoreInput['defects'],
  today: Date,
  diffDays: (a: Date, b: Date) => number,
): QualityResult {
  const active = defects.filter((d) => isActiveDefect(d.status))

  const severityLoad = active.reduce((sum, d) => sum + SEVERITY_WEIGHT[d.severity], 0)
  const oldestAge = active.reduce(
    (max, d) => Math.max(max, ageDays(d.created_at, today, diffDays)),
    0,
  )
  const maxOverdue = active.reduce(
    (max, d) => Math.max(max, overdueDays(d.due_date, today, diffDays)),
    0,
  )

  const severityScore = clamp100(Math.round((100 * severityLoad) / QUALITY_SEVERITY_CAP))
  const ageScore = clamp100(Math.round((100 * oldestAge) / QUALITY_AGE_CAP_DAYS))
  const latenessScore = clamp100(Math.round((100 * maxOverdue) / QUALITY_OVERDUE_CAP_DAYS))

  const quality = Math.round(
    QUALITY_W_SEVERITY * severityScore +
      QUALITY_W_AGE * ageScore +
      QUALITY_W_LATENESS * latenessScore,
  )

  return {
    quality: clamp100(quality),
    severityLoad,
    oldestAge,
    maxOverdue,
    activeCount: active.length,
  }
}

interface DeliveryResult {
  delivery: number
  overdueCount: number
  maxDaysOverdue: number
}

function computeDelivery(
  defects: RiskScoreInput['defects'],
  workOrders: RiskScoreInput['workOrders'],
  today: Date,
  diffDays: (a: Date, b: Date) => number,
): DeliveryResult {
  const overdueDefects = defects
    .filter((d) => isActiveDefect(d.status))
    .map((d) => overdueDays(d.due_date, today, diffDays))
    .filter((days) => days > 0)
  const overdueOrders = workOrders
    .filter((w) => isActiveWorkOrder(w.status))
    .map((w) => overdueDays(w.due_date, today, diffDays))
    .filter((days) => days > 0)

  const overdueDaysList = [...overdueDefects, ...overdueOrders]
  const overdueCount = overdueDaysList.length
  const maxDaysOverdue = overdueCount > 0 ? Math.max(...overdueDaysList) : 0

  const countScore = clamp100(Math.round((100 * overdueCount) / OVERDUE_ITEM_CAP))
  const latenessScore = clamp100(Math.round((100 * maxDaysOverdue) / OVERDUE_DAYS_CAP))

  const delivery = Math.round(DELIVERY_W_COUNT * countScore + DELIVERY_W_LATENESS * latenessScore)

  return { delivery: clamp100(delivery), overdueCount, maxDaysOverdue }
}

interface EvidenceResult {
  evidence: number
  staleDays: number
}

/**
 * evidence = clamp(round(100·(windowDays − evidenceDays) / windowDays), 0, 100).
 *
 * - evidenceDays === 0      → 100 (fully stale — no documentation in window).
 * - evidenceDays >= windowDays → 0 (documentation fully current).
 * - Linear between the two extremes.
 */
function computeEvidence(evidenceDays: number, windowDays: number): EvidenceResult {
  const window = Math.max(1, windowDays)
  const staleDays = Math.max(0, windowDays - evidenceDays)
  const evidence = clamp100(Math.round((100 * staleDays) / window))
  return { evidence, staleDays }
}

/**
 * confidence — data recency + coverage:
 *  - low:    evidenceDays < 3 OR (no defects AND no work orders)
 *  - high:   evidenceDays >= 5 AND (defects.length > 0 OR workOrders.length > 0)
 *  - medium: otherwise
 */
function confidenceFor(input: RiskScoreInput): 'high' | 'medium' | 'low' {
  const hasData = input.defects.length > 0 || input.workOrders.length > 0
  if (input.evidenceDays < CONFIDENCE_LOW_EVIDENCE_DAYS || !hasData) return 'low'
  if (input.evidenceDays >= CONFIDENCE_HIGH_EVIDENCE_DAYS && hasData) return 'high'
  return 'medium'
}

function tierForScore(score: number): RiskTier {
  if (score <= TIER_LOW_MAX) return 'low'
  if (score <= TIER_MEDIUM_MAX) return 'medium'
  if (score <= TIER_HIGH_MAX) return 'high'
  return 'critical'
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeRiskScore(input: RiskScoreInput): RiskScoreResult {
  const diffDays = input.diffDays ?? diffCalendarDaysUTC
  const { today } = input

  const qualityResult = computeQuality(input.defects, today, diffDays)
  const deliveryResult = computeDelivery(input.defects, input.workOrders, today, diffDays)
  const evidenceResult = computeEvidence(input.evidenceDays, input.windowDays)

  const signals: RiskSignal[] = []

  // quality signals (only drivers that actually contribute)
  if (qualityResult.severityLoad > 0) {
    signals.push({
      reason: `Open/in-progress defect severity load: ${qualityResult.severityLoad} (low=1, medium=2, high=4, critical=8)`,
      value: qualityResult.severityLoad,
      threshold: QUALITY_SEVERITY_CAP,
      action: 'Resolve open defects, starting with the most severe.',
    })
  }
  if (qualityResult.oldestAge > 0) {
    signals.push({
      reason: `Oldest open defect age: ${qualityResult.oldestAge} days`,
      value: qualityResult.oldestAge,
      threshold: QUALITY_AGE_CAP_DAYS,
      action: 'Investigate and close aged defects.',
    })
  }
  if (qualityResult.maxOverdue > 0) {
    signals.push({
      reason: `Most overdue open defect: ${qualityResult.maxOverdue} days past due`,
      value: qualityResult.maxOverdue,
      threshold: QUALITY_OVERDUE_CAP_DAYS,
      action: 'Re-scope or escalate overdue defect(s).',
    })
  }

  // delivery signals (only drivers that actually contribute)
  if (deliveryResult.overdueCount > 0) {
    signals.push({
      reason: `Overdue active work orders/defects: ${deliveryResult.overdueCount}`,
      value: deliveryResult.overdueCount,
      threshold: OVERDUE_ITEM_CAP,
      action: 'Re-plan due dates or notify the responsible crew.',
    })
  }
  if (deliveryResult.maxDaysOverdue > 0) {
    signals.push({
      reason: `Worst overdue item: ${deliveryResult.maxDaysOverdue} days late`,
      value: deliveryResult.maxDaysOverdue,
      threshold: OVERDUE_DAYS_CAP,
      action: 'Prioritize the most overdue items.',
    })
  }

  // evidence signal (only when documentation is actually stale)
  if (evidenceResult.evidence > 0) {
    signals.push({
      reason: `Documentation stale: ${evidenceResult.staleDays} of ${input.windowDays} window days without evidence (last evidence: ${input.lastEvidenceDate ?? 'none'})`,
      value: evidenceResult.staleDays,
      threshold: input.windowDays,
      action: 'Capture photos, daily logs, or attendance to freshen documentation.',
    })
  }

  const { quality, delivery, evidence } = {
    quality: qualityResult.quality,
    delivery: deliveryResult.delivery,
    evidence: evidenceResult.evidence,
  }

  const score = clamp100(
    Math.round(W_QUALITY * quality + W_DELIVERY * delivery + W_EVIDENCE * evidence),
  )

  return {
    score,
    tier: tierForScore(score),
    quality,
    delivery,
    evidence,
    confidence: confidenceFor(input),
    signals,
  }
}

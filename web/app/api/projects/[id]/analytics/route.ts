import { NextRequest } from 'next/server'
import { TZDate } from '@date-fns/tz'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/api/company-auth'
import {
  addDays,
  dayKeyInTz,
  diffCalendarDays,
  projectTz,
  todayStartInTz,
} from '@/lib/time'
import {
  computeRiskScore,
  type RiskScoreInput,
  type RiskScoreResult,
} from '@/lib/risk-score'
import type { DefectSeverity, DefectStatus, WorkOrderStatus } from '@/types/database'

/** Risk window: days of documentation evidence that keep the score fresh. */
const EVIDENCE_WINDOW_DAYS = 7
/** KPI: photo count over the trailing 30 calendar days. */
const LAST_30_DAYS = 30

// ---------------------------------------------------------------------------
// Types — the API contract (SPEC Phase 2 §4).
// ---------------------------------------------------------------------------

export interface ProjectAnalyticsSummary {
  photoCount: number
  activeDays: number
  openDefects: number
  inProgressDefects: number
  resolvedDefects: number
  openWorkOrders: number
  overdueWorkOrders: number
  photosLast30Days: number
  firstPhotoDate: string | null
  lastPhotoDate: string | null
}

export interface ProjectAnalyticsResponse {
  projectId: string
  risk: RiskScoreResult
  summary: ProjectAnalyticsSummary
}

/**
 * Reduced read view for field/read-only roles (photographer, foreman, client):
 * the explainable risk score + photo/defect KPIs, WITHOUT work-order/internal
 * details (openWorkOrders, overdueWorkOrders). Mirrors how the client-side
 * ProjectAnalytics view splits manager vs read-only data today.
 */
export type ProjectAnalyticsReducedResponse = {
  projectId: string
  risk: RiskScoreResult
  summary: Omit<ProjectAnalyticsSummary, 'openWorkOrders' | 'overdueWorkOrders'>
}

// Narrow row shapes for the admin-client queries (the admin client is untyped).
type PhotoRow = { taken_at: string | null; created_at: string }
type DefectRow = {
  severity: DefectSeverity
  status: DefectStatus
  due_date: string | null
  created_at: string
}
type WorkOrderRow = { status: WorkOrderStatus; due_date: string | null }
type DailyLogRow = { created_at: string }
type AttendanceRow = { check_in: string }

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Manager roles (site_manager | admin) get the full analytics contract. */
export function isManagerRole(role: string | null | undefined): boolean {
  return role === 'site_manager' || role === 'admin'
}

/**
 * Start-of-day instant (in the project tz) for a Postgres `date` day key
 * ('YYYY-MM-DD'). The risk engine parses `due_date` via `new Date(value)`;
 * passing the raw day key would parse as UTC midnight and shift a calendar
 * day for negative-offset timezones. Normalizing to the project-tz start of
 * the same day keeps the tz-aware diffDays() measurement correct everywhere.
 */
function dayKeyToStartIso(dayKey: string, tz: string): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  // TZDate.toISOString() is tz-offset aware; wrap via getTime() to a plain
  // Date so the returned instant is a UTC-normalized ISO string (matches
  // todayStartInTz in lib/time.ts).
  const start = new TZDate(year, month - 1, day, 0, 0, 0, 0, tz)
  return new Date(start.getTime()).toISOString()
}

export function computeAnalyticsSummary(
  photos: PhotoRow[],
  defects: DefectRow[],
  workOrders: WorkOrderRow[],
  today: Date,
  tz: string,
): ProjectAnalyticsSummary {
  const todayKey = dayKeyInTz(today.toISOString(), tz)
  const cutoff30Key = dayKeyInTz(addDays(tz, today, -(LAST_30_DAYS - 1)).toISOString(), tz)

  const photoDayKeys = photos
    .map((p) => p.taken_at ?? p.created_at)
    .filter((iso): iso is string => iso !== null)
    .map((iso) => dayKeyInTz(iso, tz))

  const distinctDayKeys = [...new Set(photoDayKeys)].sort((a, b) => a.localeCompare(b))

  const openDefects = defects.filter((d) => d.status === 'open').length
  const inProgressDefects = defects.filter((d) => d.status === 'in_progress').length
  const resolvedDefects = defects.filter(
    (d) => d.status === 'resolved' || d.status === 'closed',
  ).length

  const activeWorkOrders = workOrders.filter(
    (w) => w.status === 'pending' || w.status === 'in_progress',
  )
  const overdueWorkOrders = activeWorkOrders.filter(
    (w) => w.due_date !== null && w.due_date < todayKey,
  ).length

  return {
    photoCount: photos.length,
    activeDays: distinctDayKeys.length,
    openDefects,
    inProgressDefects,
    resolvedDefects,
    openWorkOrders: activeWorkOrders.length,
    overdueWorkOrders,
    photosLast30Days: photoDayKeys.filter((k) => k >= cutoff30Key).length,
    firstPhotoDate: distinctDayKeys[0] ?? null,
    lastPhotoDate: distinctDayKeys[distinctDayKeys.length - 1] ?? null,
  }
}

export interface EvidenceStats {
  evidenceDays: number
  lastEvidenceDate: string | null
}

/**
 * Distinct calendar days (in the project tz) with any documentation evidence —
 * photos (taken_at ?? created_at), daily logs (created_at), attendance
 * (check_in) — within the trailing `windowDays` window ending today. Also the
 * most recent evidence instant (for the risk engine's stale-documentation
 * signal message).
 */
export function computeEvidenceStats(
  photos: PhotoRow[],
  dailyLogs: DailyLogRow[],
  attendanceLogs: AttendanceRow[],
  today: Date,
  tz: string,
  windowDays = EVIDENCE_WINDOW_DAYS,
): EvidenceStats {
  const todayKey = dayKeyInTz(today.toISOString(), tz)
  const cutoffKey = dayKeyInTz(addDays(tz, today, -(windowDays - 1)).toISOString(), tz)

  const evidenceDayKeys = new Set<string>()
  let lastEvidenceDate: string | null = null

  const consider = (iso: string | null): void => {
    if (iso === null) return
    const key = dayKeyInTz(iso, tz)
    if (key >= cutoffKey && key <= todayKey) evidenceDayKeys.add(key)
    if (lastEvidenceDate === null || iso > lastEvidenceDate) lastEvidenceDate = iso
  }

  for (const photo of photos) consider(photo.taken_at ?? photo.created_at)
  for (const log of dailyLogs) consider(log.created_at)
  for (const log of attendanceLogs) consider(log.check_in)

  return { evidenceDays: evidenceDayKeys.size, lastEvidenceDate }
}

/** Build the risk-engine input from the queried rows, anchoring dates in tz. */
export function buildRiskInput(
  defects: DefectRow[],
  workOrders: WorkOrderRow[],
  evidence: EvidenceStats,
  today: Date,
  tz: string,
): RiskScoreInput {
  return {
    defects: defects.map((d) => ({
      ...d,
      due_date: d.due_date === null ? null : dayKeyToStartIso(d.due_date, tz),
    })),
    workOrders: workOrders.map((w) => ({
      ...w,
      due_date: w.due_date === null ? null : dayKeyToStartIso(w.due_date, tz),
    })),
    evidenceDays: evidence.evidenceDays,
    windowDays: EVIDENCE_WINDOW_DAYS,
    lastEvidenceDate: evidence.lastEvidenceDate,
    today,
    diffDays: (a, b) => diffCalendarDays(tz, a, b),
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * Resolve the IANA timezone for a project: projects.timezone ->
 * companies.timezone (of the project owner's company) -> DEFAULT_TZ.
 * Anchors the "today" instant at start-of-day in the project's own timezone.
 */
async function resolveProjectTz(db: SupabaseClient, projectId: string): Promise<string> {
  const { data: project } = await db
    .from('projects')
    .select('timezone, user_id')
    .eq('id', projectId)
    .single()

  if (project?.timezone) return projectTz(project)

  const { data: profile } = await db
    .from('profiles')
    .select('company_name')
    .eq('id', project?.user_id ?? '')
    .single()

  if (!profile?.company_name) return projectTz(project)

  const { data: company } = await db
    .from('companies')
    .select('timezone')
    .eq('name', profile.company_name)
    .single()

  return projectTz(project, company)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, id)

    const tz = await resolveProjectTz(admin, id)

    // Manager roles (site_manager | admin) get the full contract; field and
    // read-only roles get the reduced read view (ProjectAnalyticsReducedResponse).
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const manager = isManagerRole((profile as { role?: string | null } | null)?.role)

    const [photosRes, defectsRes, workOrdersRes, dailyLogsRes, attendanceRes] =
      await Promise.all([
        admin.from('photos').select('taken_at, created_at').eq('project_id', id),
        admin.from('defects').select('severity, status, due_date, created_at').eq('project_id', id),
        admin.from('work_orders').select('status, due_date').eq('project_id', id),
        admin.from('daily_logs').select('created_at').eq('project_id', id),
        admin.from('attendance_logs').select('check_in').eq('project_id', id),
      ])

    for (const res of [photosRes, defectsRes, workOrdersRes, dailyLogsRes, attendanceRes]) {
      if (res.error) return errorResponse(res.error.message, 500)
    }

    const photos = (photosRes.data ?? []) as PhotoRow[]
    const defects = (defectsRes.data ?? []) as DefectRow[]
    const workOrders = (workOrdersRes.data ?? []) as WorkOrderRow[]
    const dailyLogs = (dailyLogsRes.data ?? []) as DailyLogRow[]
    const attendanceLogs = (attendanceRes.data ?? []) as AttendanceRow[]

    const today = todayStartInTz(tz)
    const summary = computeAnalyticsSummary(photos, defects, workOrders, today, tz)
    const evidence = computeEvidenceStats(photos, dailyLogs, attendanceLogs, today, tz)
    const risk = computeRiskScore(buildRiskInput(defects, workOrders, evidence, today, tz))

    if (manager) {
      const payload: ProjectAnalyticsResponse = { projectId: id, risk, summary }
      return successResponse(payload)
    }

    const reduced: ProjectAnalyticsReducedResponse = {
      projectId: id,
      risk,
      summary: {
        photoCount: summary.photoCount,
        activeDays: summary.activeDays,
        openDefects: summary.openDefects,
        inProgressDefects: summary.inProgressDefects,
        resolvedDefects: summary.resolvedDefects,
        photosLast30Days: summary.photosLast30Days,
        firstPhotoDate: summary.firstPhotoDate,
        lastPhotoDate: summary.lastPhotoDate,
      },
    }
    return successResponse(reduced)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

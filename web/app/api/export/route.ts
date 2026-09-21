import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse } from '@/lib/api/errors'
import { monitoring } from '@/lib/monitoring'
import { EXPORT_TYPES, type ExportType } from '@/lib/export'

/** Escape a single CSV field: quote it when it contains a comma, quote, or
 * line break; double inner quotes. Exported for unit testing / reuse. */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Build a CSV document: header row + data rows, CRLF line endings, UTF-8 BOM
 * so Excel opens non-ASCII (Cyrillic) content correctly. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function toCell(value: string | number | null): string {
  return value === null ? '' : String(value)
}

interface DefectRow {
  id: string
  title: string
  description: string
  severity: string
  status: string
  assigned_to: string | null
  created_by: string
  created_at: string
}

interface PhotoRow {
  id: string
  image_url: string
  taken_at: string | null
  latitude: number | null
  longitude: number | null
  note: string | null
  created_at: string
}

interface DailyLogRow {
  id: string
  user_id: string
  log_date: string
  weather: string | null
  temperature: string | null
  work_description: string
  notes: string | null
  created_at: string
  updated_at: string
}

export const MAX_EXPORT_ROWS = 5000

export function createCsvStream(
  headers: string[],
  rows: string[][],
  isTruncated = false,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('\uFEFF'))
      controller.enqueue(encoder.encode(headers.map(escapeCsvField).join(',') + '\r\n'))

      const CHUNK_SIZE = 100
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        const chunkStr = chunk.map((r) => r.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
        controller.enqueue(encoder.encode(chunkStr))
      }

      if (isTruncated) {
        controller.enqueue(
          encoder.encode(
            `# Notice: Export truncated to ${MAX_EXPORT_ROWS.toLocaleString()} rows. Please filter by date to refine.\r\n`,
          ),
        )
      }
      controller.close()
    },
  })
}

export function defectsToCsv(rows: DefectRow[]): string {
  return toCsv(
    ['id', 'title', 'description', 'severity', 'status', 'assigned_to', 'created_by', 'created_at'],
    rows.map((r) => [r.id, r.title, r.description, r.severity, r.status, toCell(r.assigned_to), r.created_by, r.created_at]),
  )
}

export function photosToCsv(rows: PhotoRow[]): string {
  return toCsv(
    ['id', 'image_url', 'taken_at', 'latitude', 'longitude', 'note', 'created_at'],
    rows.map((r) => [r.id, r.image_url, toCell(r.taken_at), toCell(r.latitude), toCell(r.longitude), toCell(r.note), r.created_at]),
  )
}

export function logsToCsv(rows: DailyLogRow[]): string {
  return toCsv(
    ['id', 'user_id', 'log_date', 'weather', 'temperature', 'work_description', 'notes', 'created_at', 'updated_at'],
    rows.map((r) => [r.id, r.user_id, r.log_date, toCell(r.weather), toCell(r.temperature), r.work_description, toCell(r.notes), r.created_at, r.updated_at]),
  )
}

interface WorkOrderRow {
  id: string
  title: string
  description: string | null
  location: string | null
  assigned_to: string | null
  assigned_by: string
  priority: string
  status: string
  due_date: string | null
  created_at: string
  updated_at: string
}

interface AttendanceRow {
  id: string
  user_id: string
  check_in: string
  check_out: string | null
  duration_minutes: number | null
  note: string | null
  created_at: string
}

export function workOrdersToCsv(rows: WorkOrderRow[]): string {
  return toCsv(
    ['id', 'title', 'description', 'location', 'assigned_to', 'assigned_by', 'priority', 'status', 'due_date', 'created_at', 'updated_at'],
    rows.map((row) => [
      row.id,
      row.title,
      toCell(row.description),
      toCell(row.location),
      toCell(row.assigned_to),
      row.assigned_by,
      row.priority,
      row.status,
      toCell(row.due_date),
      row.created_at,
      row.updated_at,
    ]),
  )
}

export function attendanceToCsv(rows: AttendanceRow[]): string {
  return toCsv(
    ['id', 'user_id', 'check_in', 'check_out', 'duration_minutes', 'note', 'created_at'],
    rows.map((row) => [
      row.id,
      row.user_id,
      row.check_in,
      toCell(row.check_out),
      toCell(row.duration_minutes),
      toCell(row.note),
      row.created_at,
    ]),
  )
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

type ExportConfig = {
  table: string
  select: string
  order: string
  headers: string[]
  toRow: (r: Record<string, unknown>) => string[]
}

const EXPORT_CONFIGS: Record<ExportType, ExportConfig> = {
  defects: {
    table: 'defects',
    select: 'id, title, description, severity, status, assigned_to, created_by, created_at',
    order: 'created_at',
    headers: ['id', 'title', 'description', 'severity', 'status', 'assigned_to', 'created_by', 'created_at'],
    toRow: (r) => [(r as unknown as DefectRow).id, (r as unknown as DefectRow).title, (r as unknown as DefectRow).description, (r as unknown as DefectRow).severity, (r as unknown as DefectRow).status, toCell((r as unknown as DefectRow).assigned_to), (r as unknown as DefectRow).created_by, (r as unknown as DefectRow).created_at],
  },
  photos: {
    table: 'photos',
    select: 'id, image_url, taken_at, latitude, longitude, note, created_at',
    order: 'taken_at',
    headers: ['id', 'image_url', 'taken_at', 'latitude', 'longitude', 'note', 'created_at'],
    toRow: (r) => [(r as unknown as PhotoRow).id, (r as unknown as PhotoRow).image_url, toCell((r as unknown as PhotoRow).taken_at), toCell((r as unknown as PhotoRow).latitude), toCell((r as unknown as PhotoRow).longitude), toCell((r as unknown as PhotoRow).note), (r as unknown as PhotoRow).created_at],
  },
  logs: {
    table: 'daily_logs',
    select: 'id, user_id, log_date, weather, temperature, work_description, notes, created_at, updated_at',
    order: 'log_date',
    headers: ['id', 'user_id', 'log_date', 'weather', 'temperature', 'work_description', 'notes', 'created_at', 'updated_at'],
    toRow: (r) => [(r as unknown as DailyLogRow).id, (r as unknown as DailyLogRow).user_id, (r as unknown as DailyLogRow).log_date, toCell((r as unknown as DailyLogRow).weather), toCell((r as unknown as DailyLogRow).temperature), (r as unknown as DailyLogRow).work_description, toCell((r as unknown as DailyLogRow).notes), (r as unknown as DailyLogRow).created_at, (r as unknown as DailyLogRow).updated_at],
  },
  work_orders: {
    table: 'work_orders',
    select: 'id, title, description, location, assigned_to, assigned_by, priority, status, due_date, created_at, updated_at',
    order: 'created_at',
    headers: ['id', 'title', 'description', 'location', 'assigned_to', 'assigned_by', 'priority', 'status', 'due_date', 'created_at', 'updated_at'],
    toRow: (r) => [(r as unknown as WorkOrderRow).id, (r as unknown as WorkOrderRow).title, toCell((r as unknown as WorkOrderRow).description), toCell((r as unknown as WorkOrderRow).location), toCell((r as unknown as WorkOrderRow).assigned_to), (r as unknown as WorkOrderRow).assigned_by, (r as unknown as WorkOrderRow).priority, (r as unknown as WorkOrderRow).status, toCell((r as unknown as WorkOrderRow).due_date), (r as unknown as WorkOrderRow).created_at, (r as unknown as WorkOrderRow).updated_at],
  },
  attendance: {
    table: 'attendance_logs',
    select: 'id, user_id, check_in, check_out, duration_minutes, note, created_at',
    order: 'check_in',
    headers: ['id', 'user_id', 'check_in', 'check_out', 'duration_minutes', 'note', 'created_at'],
    toRow: (r) => [(r as unknown as AttendanceRow).id, (r as unknown as AttendanceRow).user_id, (r as unknown as AttendanceRow).check_in, toCell((r as unknown as AttendanceRow).check_out), toCell((r as unknown as AttendanceRow).duration_minutes), toCell((r as unknown as AttendanceRow).note), (r as unknown as AttendanceRow).created_at],
  },
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const exportRateLimit = checkRateLimit(`export:${user.id || getClientIp(request)}`, { limit: 20, windowMs: 60 * 1000 })
    if (!exportRateLimit.success) {
      return rateLimitResponse(exportRateLimit, 'Премногу барања за извоз. Обидете се повторно наскоро.')
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    const typeParam = request.nextUrl.searchParams.get('type')

    if (!projectId) return errorResponse('Missing projectId parameter', 400)
    if (!typeParam || !isExportType(typeParam)) {
      return errorResponse('Invalid type parameter (expected defects, photos, logs, work_orders, or attendance)', 400)
    }

    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    const config = EXPORT_CONFIGS[typeParam]
    let query = admin
      .from(config.table)
      .select(config.select)
      .eq('project_id', projectId)
      .order(config.order, { ascending: false, ...(typeParam === 'photos' ? { nullsFirst: false } : {}) })

    if (typeof (query as unknown as { limit?: unknown }).limit === 'function') {
      query = (query as unknown as { limit: (n: number) => typeof query }).limit(MAX_EXPORT_ROWS + 1)
    }

    const { data: rawRows, error } = await query

    if (error) {
      monitoring.captureException(new Error(error.message), { extra: { op: 'export', type: typeParam } })
      return errorResponse('Внатрешна грешка на серверот.', 500)
    }

    const allRows = ((rawRows ?? []) as unknown) as Record<string, unknown>[]
    const isTruncated = allRows.length > MAX_EXPORT_ROWS
    const exportRows = isTruncated ? allRows.slice(0, MAX_EXPORT_ROWS) : allRows
    const dataRows = exportRows.map(config.toRow)

    const stream = createCsvStream(config.headers, dataRows, isTruncated)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `${sanitizeFilenamePart(projectId)}-${typeParam}-${datePart}.csv`

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...(isTruncated ? { 'X-Export-Truncated': 'true' } : {}),
      },
    })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

function isExportType(value: string): value is ExportType {
  const types: ReadonlySet<string> = new Set(EXPORT_TYPES)
  return types.has(value)
}

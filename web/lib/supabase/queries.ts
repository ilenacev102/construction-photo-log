import type {
  Project,
  Photo,
  DailyLog,
  DailyLogInsert,
  DailyLogUpdate,
  Defect,
  DefectSeverity,
  DefectStatus,
  AttendanceLog,
  DrawingPin,
  PinType,
  AuditLog,
  SiteSchema,
  SchemaPhotoPin,
  SchemaPinWithPhoto,
  ProjectMemberRole,
  ProjectMemberWithProfile,
  Profile,
} from '@/types/database'

// ── Helpers ──

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

export async function apiDelete<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data as T
}

// ── Projects ──

export async function getProjects(): Promise<Project[]> {
  return apiGet('/api/projects')
}

export async function getProject(id: string): Promise<Project | null> {
  return apiGet(`/api/projects/${id}`)
}

export async function createProject(
  name: string,
  address?: string,
  client_name?: string,
): Promise<Project> {
  return apiPost('/api/projects', { name, address, client_name })
}

export async function deleteProject(id: string): Promise<void> {
  await apiDelete(`/api/projects/${id}`)
}

// ── Project Members ──

export async function getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  return apiGet(`/api/projects/${encodeURIComponent(projectId)}/members`)
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
): Promise<ProjectMemberWithProfile> {
  return apiPost(`/api/projects/${encodeURIComponent(projectId)}/members`, { userId, role })
}

export async function removeProjectMember(projectId: string, userId: string): Promise<{ removed: boolean }> {
  return apiDelete(`/api/projects/${encodeURIComponent(projectId)}/members`, { userId })
}

export async function getProjectTeam(projectId: string): Promise<Profile[]> {
  return apiGet(`/api/team?projectId=${encodeURIComponent(projectId)}`)
}

// ── Photos ──

export async function getPhotos(
  projectId: string,
  options?: { limit?: number; offset?: number },
): Promise<Photo[]> {
  const params = new URLSearchParams({ projectId })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  return apiGet(`/api/photos?${params.toString()}`)
}

export async function deletePhoto(id: string): Promise<void> {
  await apiDelete('/api/photos', { id })
}

// ── Daily Log queries ──

export async function getDailyLogs(projectId: string): Promise<DailyLog[]> {
  return apiGet(`/api/daily-logs?projectId=${encodeURIComponent(projectId)}`)
}

export async function createDailyLog(log: DailyLogInsert): Promise<DailyLog> {
  return apiPost('/api/daily-logs', log)
}

export async function updateDailyLog(id: string, updates: DailyLogUpdate): Promise<DailyLog> {
  return apiPatch('/api/daily-logs', { id, updates })
}

export async function deleteDailyLog(id: string): Promise<void> {
  await apiDelete('/api/daily-logs', { id })
}

// ── Defect queries ──

export async function getDefects(
  projectId: string,
  statusFilter?: DefectStatus | 'all',
  options?: { limit?: number; offset?: number },
): Promise<Defect[]> {
  const params = new URLSearchParams({ projectId })
  if (statusFilter && statusFilter !== 'all') params.set('statusFilter', statusFilter)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  return apiGet(`/api/defects?${params.toString()}`)
}

export async function createDefect(defect: {
  project_id: string
  title: string
  description?: string
  severity?: DefectSeverity
  assigned_to?: string
  location?: string
  photo_ids?: string[]
}): Promise<Defect> {
  return apiPost('/api/defects', defect)
}

export async function updateDefectStatus(
  id: string,
  status: DefectStatus,
  resolutionNotes?: string,
): Promise<Defect> {
  return apiPatch('/api/defects', { id, status, resolutionNotes })
}

export async function deleteDefect(id: string): Promise<void> {
  await apiDelete('/api/defects', { id })
}

// ── Attendance queries ──

export async function getAttendanceLogs(projectId: string): Promise<AttendanceLog[]> {
  return apiGet(`/api/attendance?projectId=${encodeURIComponent(projectId)}`)
}

export async function checkIn(projectId: string, note?: string): Promise<AttendanceLog> {
  return apiPost('/api/attendance', { subAction: 'checkIn', projectId, note })
}

export async function checkOut(logId: string): Promise<AttendanceLog> {
  return apiPost('/api/attendance', { subAction: 'checkOut', logId })
}

export async function getTodayAttendance(projectId: string): Promise<AttendanceLog[]> {
  return apiGet(`/api/attendance?projectId=${encodeURIComponent(projectId)}&today=true`)
}

// ── Drawing Pin queries ──

export async function getPins(photoId: string): Promise<DrawingPin[]> {
  return apiGet(`/api/pins?photoId=${encodeURIComponent(photoId)}`)
}

export async function createPin(pin: {
  photo_id: string
  pin_type: PinType
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  label?: string
  drawing_data?: Record<string, unknown>
}): Promise<DrawingPin> {
  return apiPost('/api/pins', pin)
}

export async function updatePin(
  id: string,
  updates: Partial<DrawingPin>,
): Promise<DrawingPin> {
  return apiPatch('/api/pins', { id, ...updates })
}

export async function deletePin(id: string): Promise<void> {
  await apiDelete('/api/pins', { id })
}

// ── Audit Log queries ──

export async function getAuditLogs(options?: {
  limit?: number
  actionFilter?: string
  entityFilter?: string
  offset?: number
}): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  if (options?.actionFilter) params.set('actionFilter', options.actionFilter)
  if (options?.entityFilter) params.set('entityFilter', options.entityFilter)
  const qs = params.toString()
  return apiGet(`/api/audit-logs${qs ? `?${qs}` : ''}`)
}

// ── Stats queries (admin dashboard) ──

export async function getDashboardStats(): Promise<{
  totalUsers: number
  totalProjects: number
  totalDefects: number
  totalPhotos: number
}> {
  return apiGet('/api/stats')
}

// ── Site Schema queries ──

export async function getProjectSchemas(projectId: string): Promise<SiteSchema[]> {
  return apiGet(`/api/schemas?projectId=${encodeURIComponent(projectId)}`)
}

export async function createSchema(params: {
  projectId: string
  name: string
  imageUrl: string
  width?: number
  height?: number
}): Promise<SiteSchema> {
  return apiPost('/api/schemas', params)
}

export async function deleteSchema(id: string): Promise<void> {
  await apiDelete('/api/schemas', { id })
}

export async function getSchemaPins(schemaId: string): Promise<SchemaPinWithPhoto[]> {
  return apiGet(`/api/schema-pins?schemaId=${encodeURIComponent(schemaId)}`)
}

export async function placePhotoOnSchema(params: {
  schemaId: string
  photoId: string
  x: number
  y: number
}): Promise<SchemaPhotoPin> {
  return apiPost('/api/schema-pins', params)
}

export async function removePhotoFromSchema(id: string): Promise<void> {
  await apiDelete('/api/schema-pins', { id })
}

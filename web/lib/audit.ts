import { monitoring } from '@/lib/monitoring'

export const AUDIT_ACTIONS = [
  'project.created',
  'project.updated',
  'project.deleted',
  'photo.uploaded',
  'photo.updated',
  'photo.deleted',
  'photo.viewed',
  'daily_log.created',
  'daily_log.updated',
  'defect.created',
  'defect.updated',
  'defect.resolved',
  'pin.created',
  'pin.updated',
  'pin.deleted',
  'attendance.check_in',
  'attendance.check_out',
  'report.generated',
  'user.login',
  'profile.updated',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const ENTITY_TYPES = [
  'project',
  'photo',
  'daily_log',
  'defect',
  'pin',
  'attendance',
  'report',
  'profile',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

interface AuditParams {
  action: AuditAction
  entityType: EntityType
  entityId?: string
  projectId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event to the audit trail.
 * Uses /api/audit-logs proxy to bypass RLS.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        projectId: params.projectId ?? null,
        auditAction: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? {},
      }),
    })
  } catch (err) {
    // Audit logging should never throw — fire-and-forget
    monitoring.captureException(err, { extra: { action: 'logAudit', auditAction: params.action } })
  }
}

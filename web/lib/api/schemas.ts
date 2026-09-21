import { z } from 'zod'

// ── Projects ──────────────────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  address: z.string().optional(),
  client_name: z.string().optional(),
})

// ── Daily Logs ────────────────────────────────────────────────────────────────
export const createDailyLogSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  log_date: z.string().min(1, 'Log date is required'),
  work_description: z.string().min(1, 'Work description is required'),
  weather: z.string().optional(),
  temperature: z.string().optional(),
  notes: z.string().optional(),
})

export const updateDailyLogSchema = z.object({
  id: z.string().uuid('Invalid log ID'),
  updates: z.record(z.string(), z.unknown()).refine((obj) => Object.keys(obj).length > 0, 'No updatable fields provided'),
})

export const deleteDailyLogSchema = z.object({
  id: z.string().uuid('Invalid log ID'),
})

// ── Defects ───────────────────────────────────────────────────────────────────
export const createDefectSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Defect title is required'),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().uuid('Invalid user ID').optional(),
  location: z.string().optional(),
  photo_ids: z.array(z.string().uuid()).optional(),
})

export const updateDefectSchema = z.object({
  id: z.string().uuid('Invalid defect ID'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed'], {
    message: 'Status must be one of: open, in_progress, resolved, closed',
  }),
  resolutionNotes: z.string().optional(),
})

export const deleteDefectSchema = z.object({
  id: z.string().uuid('Invalid defect ID'),
})

// ── Work Orders ───────────────────────────────────────────────────────────────
export const createWorkOrderSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Work order title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  assigned_to: z.string().uuid('Invalid user ID').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
})

export const updateWorkOrderSchema = z.object({
  id: z.string().uuid('Invalid work order ID'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  assigned_to: z.string().uuid('Invalid user ID').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
})

export const deleteWorkOrderSchema = z.object({
  id: z.string().uuid('Invalid work order ID'),
})

// ── Pins ──────────────────────────────────────────────────────────────────────
export const createPinSchema = z.object({
  photo_id: z.string().uuid('Invalid photo ID'),
  pin_type: z.string().min(1, 'Pin type is required'),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().optional(),
  label: z.string().optional(),
  drawing_data: z.unknown().optional(),
})

export const updatePinSchema = z.object({
  id: z.string().uuid('Invalid pin ID'),
})

export const deletePinSchema = z.object({
  id: z.string().uuid('Invalid pin ID'),
})

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceSchema = z.object({
  subAction: z.enum(['checkIn', 'checkOut'], {
    message: 'subAction must be checkIn or checkOut',
  }),
  projectId: z.string().uuid('Invalid project ID').optional(),
  note: z.string().optional(),
  logId: z.string().uuid('Invalid log ID').optional(),
})

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const createAuditLogSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  auditAction: z.string().min(1, 'Action is required'),
  entityType: z.string().min(1, 'Entity type is required'),
  entityId: z.string().optional(),
  metadata: z.unknown().optional(),
})

// ── Invite ────────────────────────────────────────────────────────────────────
export const inviteActionSchema = z.object({
  action: z.enum(
    ['getAvailableUsers', 'inviteUser', 'revokeInvite', 'getInvitations'],
    { message: 'Unknown action' },
  ),
  projectId: z.string().uuid('Invalid project ID').optional(),
  targetUserId: z.string().uuid('Invalid user ID').optional(),
})

// ── Labels ────────────────────────────────────────────────────────────────────
export const createLabelGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  slug: z.string().min(1, 'Group slug is required'),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  selection_mode: z.string().optional(),
  required: z.boolean().optional(),
})

export const updateLabelGroupSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  selection_mode: z.string().optional(),
  required: z.boolean().optional(),
})

export const createLabelItemSchema = z.object({
  group_id: z.string().uuid('Invalid group ID'),
  name: z.string().min(1, 'Label name is required'),
  slug: z.string().min(1, 'Label slug is required'),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
})

export const updateLabelItemSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
})

// ── Permissions ───────────────────────────────────────────────────────────────
export const updatePermissionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  permissionKey: z.string().min(1, 'Permission key is required'),
  granted: z.boolean(),
})

// ── Photos ────────────────────────────────────────────────────────────────────
export const deletePhotoSchema = z.object({
  id: z.string().uuid('Invalid photo ID'),
})

// ── Schema Pins ───────────────────────────────────────────────────────────────
export const createSchemaPinSchema = z.object({
  schemaId: z.string().uuid('Invalid schema ID'),
  photoId: z.string().uuid('Invalid photo ID'),
  x: z.number(),
  y: z.number(),
})

export const deleteSchemaPinSchema = z.object({
  id: z.string().uuid('Invalid pin ID'),
})

// ── Schemas ───────────────────────────────────────────────────────────────────
export const createSchemaSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().min(1, 'Schema name is required'),
  imageUrl: z.string().url('Invalid image URL'),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
})

export const updateSchemaSchema = z.object({
  id: z.string().uuid('Invalid schema ID'),
  name: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
})

export const deleteSchemaSchema = z.object({
  id: z.string().uuid('Invalid schema ID'),
})

// ── Taggings ──────────────────────────────────────────────────────────────────
export const createTaggingSchema = z.object({
  taggable_type: z.string().min(1, 'Taggable type is required'),
  taggable_id: z.string().uuid('Invalid taggable ID'),
  label_id: z.string().uuid('Invalid label ID'),
})

export const batchTaggingSchema = z.object({
  taggable_type: z.string().min(1, 'Taggable type is required'),
  taggable_id: z.string().uuid('Invalid taggable ID'),
  label_ids: z.array(z.string().uuid()).min(1, 'At least one label ID is required'),
})

// ── Comments ──────────────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  entityType: z.enum(['photo', 'defect', 'work_order']),
  entityId: z.string().uuid('Invalid entity ID'),
  body: z.string().min(1, 'Comment body is required').max(5000, 'Comment too long'),
  parentId: z.string().uuid().optional(),
})

// ── Users ─────────────────────────────────────────────────────────────────────
export const updateUserRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['photographer', 'foreman', 'site_manager', 'client', 'admin'], {
    message: 'Unknown role',
  }),
})

// ── Report ────────────────────────────────────────────────────────────────────
export const generateReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  photoIds: z.array(z.string().uuid()).min(1, 'At least one photo is required'),
  title: z.string().min(1, 'Report title is required'),
  language: z.enum(['mk', 'en', 'de', 'sl', 'sr']).optional(),
})

// ── Work Order Defects ────────────────────────────────────────────────────────
export const linkDefectToWorkOrderSchema = z.object({
  defectId: z.string().uuid('Invalid defect ID'),
})

// ── Defect Photos ─────────────────────────────────────────────────────────────
export const updateDefectPhotoSchema = z.object({
  action: z.enum(['add', 'remove']),
  photoId: z.string().uuid('Invalid photo ID'),
})

// ── Project Members ───────────────────────────────────────────────────────────
export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['photographer', 'foreman', 'site_manager', 'client'], {
    message: 'Невалидна улога.',
  }),
})

export const removeMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
})

// ── Notifications ─────────────────────────────────────────────────────────────
export const markNotificationReadSchema = z.object({
  // Empty schema — PATCH with no body, just the path param
}).optional()

// The notifications table is untyped on the admin client (no Database generic),
// so rows built in route handlers are validated here before insert. Inserts are
// best-effort side effects — a validation failure must never fail the comment POST.
export const insertNotificationSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  type: z.enum(['mention', 'reply']),
  comment_id: z.string().uuid('Invalid comment ID'),
})

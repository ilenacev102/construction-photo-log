import { z } from 'zod'

// ── Common ──────────────────────────────────────────────────────

const uuid = z.string().uuid()
const nonEmptyString = z.string().min(1).max(500)

// ── Upload photo ─────────────────────────────────────────────────

export const uploadPhotoSchema = z.object({
  projectId: uuid,
  note: z.string().max(2000).optional().nullable().default(null),
  takenAt: z
    .string()
    .max(50)
    .transform((v) => (v === '' ? null : v))
    .optional()
    .nullable()
    .default(null),
  latitude: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? parseFloat(v) : v))
    .pipe(z.number().min(-90).max(90))
    .optional()
    .nullable()
    .default(null),
  longitude: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? parseFloat(v) : v))
    .pipe(z.number().min(-180).max(180))
    .optional()
    .nullable()
    .default(null),
})

export type UploadPhotoInput = z.infer<typeof uploadPhotoSchema>

// ── Upload schema (site plan) ────────────────────────────────────

export const uploadSchemaSchema = z.object({
  projectId: uuid,
  name: nonEmptyString,
})

export type UploadSchemaInput = z.infer<typeof uploadSchemaSchema>

// ── Auth (login / signup) ─────────────────────────────────────────

export const authSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type AuthInput = z.infer<typeof authSchema>

// ── Daily log ────────────────────────────────────────────────────

export const dailyLogSchema = z.object({
  logDate: z.string().min(1, 'Date is required'),
  weather: z.string().optional().default(''),
  temperature: z.string().optional().default(''),
  workDescription: z.string().min(1, 'Work description is required'),
  notes: z.string().optional().default(''),
})

export type DailyLogInput = z.infer<typeof dailyLogSchema>

// ── Defect create ────────────────────────────────────────────────

export const defectCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export type DefectCreateInput = z.infer<typeof defectCreateSchema>

// ── Work order create / edit ─────────────────────────────────────

export const workOrderCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  location: z.string().optional().default(''),
  assigned_to: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional().default(''),
})

export type WorkOrderCreateInput = z.infer<typeof workOrderCreateSchema>

// ── Comment ──────────────────────────────────────────────────────

export const commentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty'),
})

export type CommentInput = z.infer<typeof commentSchema>

// ── New project ──────────────────────────────────────────────────

export const newProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional().default(''),
  clientName: z.string().optional().default(''),
})

export type NewProjectInput = z.infer<typeof newProjectSchema>

// ── Validation helper ────────────────────────────────────────────

export function validateFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  fields: (keyof z.input<T>)[],
): { success: true; data: z.output<T> } | { success: false; error: string } {
  const raw: Record<string, unknown> = {}
  for (const field of fields) {
    const value = formData.get(field as string)
    if (value !== null) raw[field as string] = value
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  return { success: true, data: result.data }
}

export interface Project {
  id: string
  name: string
  address: string | null
  client_name: string | null
  user_id: string
  trade: TradeType
  timezone: string | null
  created_at: string
}

// === Companies (tenant root) ===

export interface Company {
  id: string
  name: string
  timezone: string
  created_at: string
}

export interface Photo {
  id: string
  project_id: string
  image_url: string
  taken_at: string | null
  latitude: number | null
  longitude: number | null
  note: string | null
  created_at: string
  trade_metadata: Record<string, string | number | boolean | string[]> | null
  user_id?: string
  thumbnail_url?: string
}

export interface Report {
  id: string
  project_id: string
  title: string
  photo_ids: string[]
  generated_at: string
  pdf_url: string | null
}

export interface DailyLog {
  id: string
  project_id: string
  user_id: string
  log_date: string
  weather: string | null
  temperature: string | null
  work_description: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type DailyLogInsert = Pick<DailyLog, 'project_id' | 'log_date' | 'work_description'> & Partial<Pick<DailyLog, 'weather' | 'temperature' | 'notes'>>

export type DailyLogUpdate = Partial<Pick<DailyLog, 'log_date' | 'weather' | 'temperature' | 'work_description' | 'notes'>>

// === User Profiles & RBAC ===

export type UserRole = 'photographer' | 'foreman' | 'site_manager' | 'client' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  company_name: string
  full_name: string
  avatar_url: string
  phone: string
  created_at: string
  updated_at: string
}

// === Trade Templates ===

export type TradeType = 'general' | 'electrical' | 'plumbing' | 'hvac' | 'concrete' | 'roofing' | 'framing' | 'drywall' | 'flooring' | 'painting' | 'masonry' | 'landscaping'

export interface TradeTemplate {
  id: string
  trade: TradeType
  label: Record<string, string>
  fields: TradeField[]
  icon: string
  sort_order: number
}

export interface TradeField {
  key: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number'
  label: Record<string, string>
  required: boolean
  options?: Record<string, string[]>
}

// === Attendance ===

export interface AttendanceLog {
  id: string
  project_id: string
  user_id: string
  check_in: string
  check_out: string | null
  duration_minutes: number | null
  note: string
  created_at: string
}

// === Defects / Punch List ===

export type DefectSeverity = 'low' | 'medium' | 'high' | 'critical'
export type DefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected'

export interface Defect {
  id: string
  project_id: string
  created_by: string
  assigned_to: string | null
  title: string
  description: string
  severity: DefectSeverity
  status: DefectStatus
  location: string
  photo_ids: string[]
  due_date: string | null
  resolved_at: string | null
  resolution_notes: string
  created_at: string
  updated_at: string
}

// === Work Orders ===

export type WorkOrderStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type WorkOrderPriority = 'low' | 'medium' | 'high'

export interface WorkOrder {
  id: string
  project_id: string
  title: string
  description: string | null
  location: string | null
  assigned_to: string | null
  assigned_by: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

// === Work Order ↔ Defect Linking ===

export interface WorkOrderDefect {
  id: string
  work_order_id: string
  defect_id: string
  created_at: string
}

// === Comments & Collaboration ===

export type CommentEntityType = 'photo' | 'defect' | 'work_order'

export interface Comment {
  id: string
  entity_type: CommentEntityType
  entity_id: string
  user_id: string
  body: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface CommentAuthor {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface CommentWithAuthor extends Comment {
  author: CommentAuthor
  replies?: CommentWithAuthor[]
}

export interface CommentMention {
  id: string
  comment_id: string
  mentioned_user_id: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'mention' | 'reply'
  comment_id: string | null
  read: boolean
  created_at: string
}

// === Drawing Pins ===

export type PinType = 'pin' | 'arrow' | 'rectangle' | 'circle' | 'freehand' | 'text'

export interface DrawingPin {
  id: string
  photo_id: string
  user_id: string
  pin_type: PinType
  x: number
  y: number
  width: number | null
  height: number | null
  color: string
  label: string
  drawing_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

// === Audit Trail ===

export interface AuditLog {
  id: string
  project_id: string | null
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// === Permissions ===

export interface Permission {
  key: string
  name: string
  description: string
  category: string
  created_at: string
}

export interface RolePermission {
  id: string
  role: UserRole
  permission_key: string
  created_at: string
}

export interface UserPermission {
  id: string
  user_id: string
  permission_key: string
  granted: boolean
  created_at: string
  updated_at: string
}

export interface UserWithPermissions extends Profile {
  permissions: string[]
}

// === Project Members ===

export type ProjectMemberRole = 'photographer' | 'foreman' | 'site_manager' | 'client'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  created_at: string
  updated_at: string
}

// A member joined with its profile data for display
export interface ProjectMemberWithProfile extends ProjectMember {
  profiles: Profile | null
}

export const PERMISSION_CATEGORIES: Record<string, string> = {
  photos: 'Photos',
  defects: 'Defects',
  projects: 'Projects',
  attendance: 'Attendance',
  daily_logs: 'Daily Logs',
  reports: 'Reports',
  pins: 'Drawing Pins',
  users: 'User Management',
  admin: 'Admin',
}

// === Subscriptions ===

export type PlanTier = 'free' | 'crew' | 'team' | 'company'

export interface Subscription {
  id: string
  user_id: string
  plan: PlanTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

// === Site Schemas / Plans ===

export interface SiteSchema {
  id: string
  project_id: string
  name: string
  image_url: string
  width: number | null
  height: number | null
  sort_order: number
  created_at: string
}

export interface SchemaPhotoPin {
  id: string
  schema_id: string
  photo_id: string
  x: number
  y: number
  created_at: string
}

// A pin joined with its photo data for display
export interface SchemaPinWithPhoto extends SchemaPhotoPin {
  photos: {
    image_url: string
    taken_at: string | null
    note: string | null
    user_id: string | null
  }
}

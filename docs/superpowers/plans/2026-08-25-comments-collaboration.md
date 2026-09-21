# Comments & Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comments and @mentions to photos, defects, and work orders with single-level threading and real-time updates.

**Architecture:** Polymorphic comment system using `entity_type` + `entity_id` pattern. Three new tables: `comments`, `comment_mentions`, `notifications`. API routes follow existing patterns with `requireProjectAccess` for auth. Components use shadcn/ui with Supabase Realtime for live updates.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + Realtime), TypeScript, shadcn/ui, Tailwind CSS

## Global Constraints

- Follow existing codebase patterns from `web/app/api/` and `web/components/`
- Use `errorResponse`, `successResponse` from `@/lib/api/errors`
- Use `requireProjectAccess` from `@/lib/api/company-auth` for auth
- Use `createClient` from `@/lib/supabase/server` for user context
- Use `createAdminClient` from `@/lib/supabase/admin` for DB operations
- All UI text in Macedonian (mk)
- No new dependencies unless absolutely necessary

---

## File Structure

```
web/
├── types/database.ts                    # Add Comment, CommentMention, Notification types
├── app/api/projects/[id]/
│   ├── comments/
│   │   ├── route.ts                     # GET (list), POST (create)
│   │   └── [commentId]/
│   │       └── route.ts                 # DELETE
│   └── notifications/
│       ├── route.ts                     # GET (list user notifications)
│       └── [notificationId]/
│           └── read/
│               └── route.ts             # PATCH (mark as read)
├── components/comments/
│   ├── CommentThread.tsx                # Main container with real-time subscription
│   ├── CommentItem.tsx                  # Single comment with author, actions
│   ├── CommentForm.tsx                  # Text input with @mention autocomplete
│   └── CommentCount.tsx                 # Badge showing count
└── lib/
    └── mentions.ts                      # Parse @mentions from comment body
```

---

## Task 1: Database Schema (SQL Migration)

**Files:**
- Create: `supabase/migrations/20260825120000_add_comments.sql`

**Interfaces:**
- Consumes: None (foundational)
- Produces: `comments`, `comment_mentions`, `notifications` tables

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260825120000_add_comments.sql

-- Comments table (polymorphic: photos, defects, work_orders)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('photo', 'defect', 'work_order')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- @mentions table
CREATE TABLE comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, mentioned_user_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comment_mentions_user ON comment_mentions(mentioned_user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- RLS policies
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Comments: users can read if they have project access
CREATE POLICY "Users can view comments on accessible projects"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.entity_id
        AND (
          projects.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_permissions
            WHERE user_permissions.user_id = auth.uid()
              AND user_permissions.permission_key = 'project.VIEW.' || projects.id
              AND user_permissions.granted = true
          )
        )
    )
    OR entity_type = 'photo'
  );

-- Comments: authenticated users can insert
CREATE POLICY "Authenticated users can insert comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments: users can delete their own
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Mentions: users can view mentions of themselves
CREATE POLICY "Users can view own mentions"
  ON comment_mentions FOR SELECT
  USING (auth.uid() = mentioned_user_id);

-- Notifications: users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications: users can update own (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at on comment edit
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260825120000_add_comments.sql
git commit -m "feat(db): add comments, comment_mentions, notifications tables"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `web/types/database.ts:1-50` (add after existing types)

**Interfaces:**
- Consumes: None
- Produces: `Comment`, `CommentWithAuthor`, `CommentMention`, `Notification` types

- [ ] **Step 1: Add types to database.ts**

```typescript
// web/types/database.ts — add after WorkOrder interface (around line 151)

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

export interface NotificationWithComment extends Notification {
  comment?: Comment
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add web/types/database.ts
git commit -m "feat(types): add Comment, CommentMention, Notification types"
```

---

## Task 3: Mention Parser Utility

**Files:**
- Create: `web/lib/mentions.ts`
- Create: `web/lib/__tests__/mentions.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `parseMentions(body: string): string[]`, `replaceMentionsWithHtml(body: string): string`

- [ ] **Step 1: Write failing test**

```typescript
// web/lib/__tests__/mentions.test.ts

import { parseMentions, replaceMentionsWithHtml } from '@/lib/mentions'

describe('parseMentions', () => {
  it('extracts single mention', () => {
    expect(parseMentions('Hello @john')).toEqual(['john'])
  })

  it('extracts multiple mentions', () => {
    expect(parseMentions('@john and @jane')).toEqual(['john', 'jane'])
  })

  it('deduplicates mentions', () => {
    expect(parseMentions('@john hello @john')).toEqual(['john'])
  })

  it('returns empty array for no mentions', () => {
    expect(parseMentions('Hello world')).toEqual([])
  })

  it('handles mentions with underscores', () => {
    expect(parseMentions('@john_doe')).toEqual(['john_doe'])
  })
})

describe('replaceMentionsWithHtml', () => {
  it('wraps mentions in span', () => {
    expect(replaceMentionsWithHtml('Hello @john')).toBe(
      'Hello <span class="text-blue-500 font-medium">@john</span>'
    )
  })

  it('handles multiple mentions', () => {
    const result = replaceMentionsWithHtml('@john and @jane')
    expect(result).toContain('@john')
    expect(result).toContain('@jane')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run lib/__tests__/mentions.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mentions'"

- [ ] **Step 3: Write implementation**

```typescript
// web/lib/mentions.ts

const MENTION_REGEX = /@(\w+)/g

/**
 * Extract unique usernames from @mentions in comment body
 */
export function parseMentions(body: string): string[] {
  const matches = body.matchAll(MENTION_REGEX)
  const usernames = new Set<string>()
  for (const match of matches) {
    usernames.add(match[1])
  }
  return Array.from(usernames)
}

/**
 * Replace @mentions with styled HTML spans for rendering
 */
export function replaceMentionsWithHtml(body: string): string {
  return body.replace(
    MENTION_REGEX,
    '<span class="text-blue-500 font-medium">@$1</span>'
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run lib/__tests__/mentions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/lib/mentions.ts web/lib/__tests__/mentions.test.ts
git commit -m "feat(mentions): add @mention parser utility with tests"
```

---

## Task 4: Comments API — GET & POST

**Files:**
- Create: `web/app/api/projects/[id]/comments/route.ts`
- Create: `web/app/api/projects/[id]/comments/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `Comment`, `CommentWithAuthor`, `CommentAuthor` from `@/types/database`
- Produces: `GET /api/projects/[id]/comments`, `POST /api/projects/[id]/comments`

- [ ] **Step 1: Write failing test**

```typescript
// web/app/api/projects/[id]/comments/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { createMockRequest } from '@/lib/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectAccess: vi.fn(),
}))

describe('/api/projects/[id]/comments', () => {
  const projectId = 'test-project-id'
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns comments for entity', async () => {
      const { requireProjectAccess } = await import('@/lib/api/company-auth')
      vi.mocked(requireProjectAccess).mockResolvedValue({ userId: 'user-1' } as any)

      const { createAdminClient } = await import('@/lib/supabase/admin')
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'comment-1',
                  entity_type: 'photo',
                  entity_id: 'photo-1',
                  user_id: 'user-1',
                  body: 'Test comment',
                  parent_id: null,
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                  profiles: { id: 'user-1', full_name: 'Test User', avatar_url: null },
                },
              ],
              error: null,
            }),
          }),
        }),
      })
      vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

      const request = createMockRequest({
        url: `http://localhost/api/projects/${projectId}/comments?entity_type=photo&entity_id=photo-1`,
      })

      const response = await GET(request, { params: { id: projectId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(1)
    })

    it('returns 400 without entity_type', async () => {
      const { requireProjectAccess } = await import('@/lib/api/company-auth')
      vi.mocked(requireProjectAccess).mockResolvedValue({ userId: 'user-1' } as any)

      const request = createMockRequest({
        url: `http://localhost/api/projects/${projectId}/comments`,
      })

      const response = await GET(request, { params: { id: projectId } })
      expect(response.status).toBe(400)
    })
  })

  describe('POST', () => {
    it('creates comment', async () => {
      const { requireProjectAccess } = await import('@/lib/api/company-auth')
      vi.mocked(requireProjectAccess).mockResolvedValue({ userId: 'user-1' } as any)

      const { createAdminClient } = await import('@/lib/supabase/admin')
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'comment-1',
              entity_type: 'photo',
              entity_id: 'photo-1',
              user_id: 'user-1',
              body: 'New comment',
              parent_id: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      })
      vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) } as any)

      const request = createMockRequest({
        method: 'POST',
        url: `http://localhost/api/projects/${projectId}/comments`,
        body: {
          entity_type: 'photo',
          entity_id: 'photo-1',
          body: 'New comment',
        },
      })

      const response = await POST(request, { params: { id: projectId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.body).toBe('New comment')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run app/api/projects/[id]/comments/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write implementation**

```typescript
// web/app/api/projects/[id]/comments/route.ts

import { NextRequest } from 'next/server'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse, parseJsonBody } from '@/lib/api/errors'
import { parseMentions } from '@/lib/mentions'
import type { CommentEntityType } from '@/types/database'

const VALID_ENTITY_TYPES: CommentEntityType[] = ['photo', 'defect', 'work_order']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return errorResponse('entity_type and entity_id are required')
    }

    if (!VALID_ENTITY_TYPES.includes(entityType as CommentEntityType)) {
      return errorResponse('Invalid entity_type')
    }

    // Verify project access
    const auth = await requireProjectAccess(projectId, 'read')
    if (auth instanceof Response) return auth

    const admin = createAdminClient()

    // Fetch comments with author info
    const { data: comments, error } = await admin
      .from('comments')
      .select(`
        *,
        author:profiles!comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    // Group into threads (top-level + replies)
    const topLevel = (comments ?? []).filter((c) => !c.parent_id)
    const replies = (comments ?? []).filter((c) => c.parent_id)

    const threaded = topLevel.map((comment) => ({
      ...comment,
      author: comment.author,
      replies: replies
        .filter((r) => r.parent_id === comment.id)
        .map((r) => ({ ...r, author: r.author })),
    }))

    return successResponse(threaded)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500
    return errorResponse(msg, status)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    const body = await parseJsonBody<{
      entity_type: string
      entity_id: string
      body: string
      parent_id?: string
    }>(request)

    // Validate
    if (!body.entity_type || !body.entity_id || !body.body) {
      return errorResponse('entity_type, entity_id, and body are required')
    }

    if (!VALID_ENTITY_TYPES.includes(body.entity_type as CommentEntityType)) {
      return errorResponse('Invalid entity_type')
    }

    if (body.body.trim().length === 0) {
      return errorResponse('Comment body cannot be empty')
    }

    // Verify project access
    const auth = await requireProjectAccess(projectId, 'read')
    if (auth instanceof Response) return auth

    const admin = createAdminClient()

    // Create comment
    const { data: comment, error } = await admin
      .from('comments')
      .insert({
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        user_id: auth.userId,
        body: body.body.trim(),
        parent_id: body.parent_id ?? null,
      })
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    // Parse and store mentions
    const mentions = parseMentions(body.body)
    if (mentions.length > 0) {
      // Look up mentioned users by username (full_name)
      const { data: mentionedUsers } = await admin
        .from('profiles')
        .select('id')
        .in('full_name', mentions)

      if (mentionedUsers && mentionedUsers.length > 0) {
        // Insert mentions
        const mentionRecords = mentionedUsers.map((u) => ({
          comment_id: comment.id,
          mentioned_user_id: u.id,
        }))

        await admin.from('comment_mentions').insert(mentionRecords)

        // Create notifications
        const notificationRecords = mentionedUsers
          .filter((u) => u.id !== auth.userId) // Don't notify self
          .map((u) => ({
            user_id: u.id,
            type: 'mention',
            comment_id: comment.id,
          }))

        if (notificationRecords.length > 0) {
          await admin.from('notifications').insert(notificationRecords)
        }
      }
    }

    // Fetch with author info
    const { data: commentWithAuthor } = await admin
      .from('comments')
      .select(`
        *,
        author:profiles!comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq('id', comment.id)
      .single()

    return successResponse(commentWithAuthor)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500
    return errorResponse(msg, status)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run app/api/projects/[id]/comments/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/api/projects/[id]/comments/route.ts web/app/api/projects/[id]/comments/__tests__/route.test.ts
git commit -m "feat(api): add comments GET and POST routes"
```

---

## Task 5: Comments API — DELETE

**Files:**
- Create: `web/app/api/projects/[id]/comments/[commentId]/route.ts`
- Create: `web/app/api/projects/[id]/comments/[commentId]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `Comment` from `@/types/database`
- Produces: `DELETE /api/projects/[id]/comments/[commentId]`

- [ ] **Step 1: Write failing test**

```typescript
// web/app/api/projects/[id]/comments/[commentId]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from '../route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/api/company-auth', () => ({
  requireProjectAccess: vi.fn(),
}))

describe('/api/projects/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DELETE', () => {
    it('deletes own comment', async () => {
      const { requireProjectAccess } = await import('@/lib/api/company-auth')
      vi.mocked(requireProjectAccess).mockResolvedValue({ userId: 'user-1' } as any)

      const { createAdminClient } = await import('@/lib/supabase/admin')
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue({ delete: mockDelete }) } as any)

      const request = new Request('http://localhost', { method: 'DELETE' })
      const response = await DELETE(request, {
        params: { id: 'project-1', commentId: 'comment-1' },
      })

      expect(response.status).toBe(200)
    })

    it('returns 403 when deleting others comment', async () => {
      const { requireProjectAccess } = await import('@/lib/api/company-auth')
      vi.mocked(requireProjectAccess).mockResolvedValue({ userId: 'user-2' } as any)

      const { createAdminClient } = await import('@/lib/supabase/admin')
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1' },
          error: null,
        }),
      })
      vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

      const request = new Request('http://localhost', { method: 'DELETE' })
      const response = await DELETE(request, {
        params: { id: 'project-1', commentId: 'comment-1' },
      })

      expect(response.status).toBe(403)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run app/api/projects/[id]/comments/[commentId]/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write implementation**

```typescript
// web/app/api/projects/[id]/comments/[commentId]/route.ts

import { NextRequest } from 'next/server'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: projectId, commentId } = params

    // Verify project access
    const auth = await requireProjectAccess(projectId, 'read')
    if (auth instanceof Response) return auth

    const admin = createAdminClient()

    // Check ownership
    const { data: comment, error: fetchError } = await admin
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (fetchError || !comment) {
      return errorResponse('Коментарот не е пронајден', 404)
    }

    if (comment.user_id !== auth.userId) {
      return errorResponse('Немате дозвола да избришете овој коментар', 403)
    }

    // Delete comment (cascades to mentions and replies via FK)
    const { error } = await admin
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse({ deleted: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500
    return errorResponse(msg, status)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx vitest run app/api/projects/[id]/comments/[commentId]/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/api/projects/[id]/comments/[commentId]/route.ts web/app/api/projects/[id]/comments/[commentId]/__tests__/route.test.ts
git commit -m "feat(api): add comments DELETE route with ownership check"
```

---

## Task 6: Notifications API

**Files:**
- Create: `web/app/api/projects/[id]/notifications/route.ts`
- Create: `web/app/api/projects/[id]/notifications/[notificationId]/read/route.ts`

**Interfaces:**
- Consumes: `Notification`, `NotificationWithComment` from `@/types/database`
- Produces: `GET /api/projects/[id]/notifications`, `PATCH /api/projects/[id]/notifications/[id]/read`

- [ ] **Step 1: Write implementation for notifications GET**

```typescript
// web/app/api/projects/[id]/notifications/route.ts

import { NextRequest } from 'next/server'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id

    // Verify project access
    const auth = await requireProjectAccess(projectId, 'read')
    if (auth instanceof Response) return auth

    const admin = createAdminClient()

    // Fetch user's unread notifications
    const { data: notifications, error } = await admin
      .from('notifications')
      .select(`
        *,
        comment:comments(*)
      `)
      .eq('user_id', auth.userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(notifications)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500
    return errorResponse(msg, status)
  }
}
```

- [ ] **Step 2: Write implementation for marking as read**

```typescript
// web/app/api/projects/[id]/notifications/[notificationId]/read/route.ts

import { NextRequest } from 'next/server'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse, successResponse } from '@/lib/api/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; notificationId: string } }
) {
  try {
    const { id: projectId, notificationId } = params

    // Verify project access
    const auth = await requireProjectAccess(projectId, 'read')
    if (auth instanceof Response) return auth

    const admin = createAdminClient()

    // Mark as read (only own notifications)
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', auth.userId)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse({ read: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500
    return errorResponse(msg, status)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/projects/[id]/notifications/route.ts web/app/api/projects/[id]/notifications/[notificationId]/read/route.ts
git commit -m "feat(api): add notifications GET and PATCH routes"
```

---

## Task 7: Comment Components

**Files:**
- Create: `web/components/comments/CommentForm.tsx`
- Create: `web/components/comments/CommentItem.tsx`
- Create: `web/components/comments/CommentThread.tsx`
- Create: `web/components/comments/CommentCount.tsx`

**Interfaces:**
- Consumes: `CommentWithAuthor`, `CommentAuthor` from `@/types/database`
- Produces: React components for comments UI

- [ ] **Step 1: Create CommentForm component**

```tsx
// web/components/comments/CommentForm.tsx

'use client'

import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>
  placeholder?: string
  submitting?: boolean
}

export function CommentForm({ onSubmit, placeholder = 'Додај коментар...', submitting = false }: CommentFormProps) {
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!body.trim() || submitting) return
    
    try {
      await onSubmit(body.trim())
      setBody('')
      textareaRef.current?.focus()
    } catch (err) {
      console.error('Failed to post comment:', err)
    }
  }, [body, submitting, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex gap-2">
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className="resize-none"
        disabled={submitting}
      />
      <Button
        onClick={handleSubmit}
        disabled={!body.trim() || submitting}
        size="icon"
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create CommentItem component**

```tsx
// web/components/comments/CommentItem.tsx

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { mk } from 'date-fns/locale'
import { Trash2, Reply } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { replaceMentionsWithHtml } from '@/lib/mentions'
import type { CommentWithAuthor } from '@/types/database'

interface CommentItemProps {
  comment: CommentWithAuthor
  currentUserId?: string
  onDelete?: (id: string) => void
  onReply?: (parentId: string) => void
  isReply?: boolean
}

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isReply = false,
}: CommentItemProps) {
  const [showActions, setShowActions] = useState(false)
  const isOwner = currentUserId === comment.user_id

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: mk,
  })

  const authorInitials = comment.author?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '??'

  return (
    <div
      className={`flex gap-3 ${isReply ? 'ml-10' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.author?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{comment.author?.full_name ?? 'Непознат'}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        <p
          className="text-sm mt-1 whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: replaceMentionsWithHtml(comment.body) }}
        />

        {!isReply && onReply && (
          <div className="mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Одговори
            </Button>
          </div>
        )}
      </div>

      {showActions && isOwner && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onDelete(comment.id)}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create CommentThread component**

```tsx
// web/components/comments/CommentThread.tsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import type { CommentWithAuthor, CommentEntityType } from '@/types/database'

interface CommentThreadProps {
  projectId: string
  entityType: CommentEntityType
  entityId: string
  currentUserId?: string
}

export function CommentThread({
  projectId,
  entityType,
  entityId,
  currentUserId,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
      })
      const response = await fetch(`/api/projects/${projectId}/comments?${params}`)
      const data = await response.json()
      if (data.data) {
        setComments(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, entityType, entityId])

  // Subscribe to real-time updates
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `entity_type=eq.${entityType} AND entity_id=eq.${entityId}`,
        },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [entityType, entityId, fetchComments])

  // Initial fetch
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Create comment
  const handleCreate = useCallback(
    async (body: string) => {
      setSubmitting(true)
      try {
        const response = await fetch(`/api/projects/${projectId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            body,
            parent_id: replyingTo,
          }),
        })
        const data = await response.json()
        if (data.data) {
          await fetchComments()
          setReplyingTo(null)
        }
      } finally {
        setSubmitting(false)
      }
    },
    [projectId, entityType, entityId, replyingTo, fetchComments]
  )

  // Delete comment
  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
          method: 'DELETE',
        })
        await fetchComments()
      } catch (err) {
        console.error('Failed to delete comment:', err)
      }
    },
    [projectId, fetchComments]
  )

  if (loading) {
    return <div className="text-sm text-muted-foreground">Се вчитуваат коментари...</div>
  }

  return (
    <div className="space-y-4">
      {/* Comment list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нема коментари. Бидете први кои ќе коментираат!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="space-y-3">
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                onDelete={handleDelete}
                onReply={setReplyingTo}
              />
              {comment.replies?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  isReply
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Одговарате на коментар</span>
          <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
            Откажи
          </Button>
        </div>
      )}

      {/* Comment form */}
      <CommentForm
        onSubmit={handleCreate}
        submitting={submitting}
        placeholder={replyingTo ? 'Внесете одговор...' : 'Додај коментар...'}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create CommentCount component**

```tsx
// web/components/comments/CommentCount.tsx

'use client'

import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import type { CommentEntityType } from '@/types/database'

interface CommentCountProps {
  projectId: string
  entityType: CommentEntityType
  entityId: string
}

export function CommentCount({ projectId, entityType, entityId }: CommentCountProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const params = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId,
        })
        const response = await fetch(`/api/projects/${projectId}/comments?${params}`)
        const data = await response.json()
        if (data.data) {
          // Count all comments (top-level + replies)
          const total = data.data.reduce(
            (acc: number, c: any) => acc + 1 + (c.replies?.length ?? 0),
            0
          )
          setCount(total)
        }
      } catch (err) {
        console.error('Failed to fetch comment count:', err)
      }
    }

    fetchCount()
  }, [projectId, entityType, entityId])

  if (count === 0) return null

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <MessageSquare className="h-4 w-4" />
      <span>{count}</span>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add web/components/comments/
git commit -m "feat(components): add CommentForm, CommentItem, CommentThread, CommentCount"
```

---

## Task 8: Integration — Add Comments to Photo Page

**Files:**
- Modify: `web/app/[locale]/dashboard/projects/[id]/photos/[photoId]/page.tsx`

**Interfaces:**
- Consumes: `CommentThread` from `@/components/comments/CommentThread`
- Produces: Photo detail page with comments section

- [ ] **Step 1: Add CommentThread to photo page**

```tsx
// In web/app/[locale]/dashboard/projects/[id]/photos/[photoId]/page.tsx
// Add import at top:
import { CommentThread } from '@/components/comments/CommentThread'

// Add comments section after photo display (before closing div):
<div className="mt-6">
  <h3 className="text-lg font-semibold mb-4">Коментари</h3>
  <CommentThread
    projectId={projectId}
    entityType="photo"
    entityId={photoId}
    currentUserId={userId}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/[locale]/dashboard/projects/[id]/photos/[photoId]/page.tsx
git commit -m "feat(photos): add comments to photo detail page"
```

---

## Task 9: Integration — Add Comments to Defect Page

**Files:**
- Modify: `web/app/[locale]/dashboard/projects/[id]/defects/[defectId]/page.tsx`

**Interfaces:**
- Consumes: `CommentThread` from `@/components/comments/CommentThread`
- Produces: Defect detail page with comments section

- [ ] **Step 1: Add CommentThread to defect page**

```tsx
// In web/app/[locale]/dashboard/projects/[id]/defects/[defectId]/page.tsx
// Add import at top:
import { CommentThread } from '@/components/comments/CommentThread'

// Add comments section after defect details:
<div className="mt-6">
  <h3 className="text-lg font-semibold mb-4">Коментари</h3>
  <CommentThread
    projectId={projectId}
    entityType="defect"
    entityId={defectId}
    currentUserId={userId}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/[locale]/dashboard/projects/[id]/defects/[defectId]/page.tsx
git commit -m "feat(defects): add comments to defect detail page"
```

---

## Task 10: Integration — Add Comments to Work Order Page

**Files:**
- Modify: `web/app/[locale]/dashboard/projects/[id]/work-orders/[workOrderId]/page.tsx`

**Interfaces:**
- Consumes: `CommentThread` from `@/components/comments/CommentThread`
- Produces: Work order detail page with comments section

- [ ] **Step 1: Add CommentThread to work order page**

```tsx
// In web/app/[locale]/dashboard/projects/[id]/work-orders/[workOrderId]/page.tsx
// Add import at top:
import { CommentThread } from '@/components/comments/CommentThread'

// Add comments section after work order details:
<div className="mt-6">
  <h3 className="text-lg font-semibold mb-4">Коментари</h3>
  <CommentThread
    projectId={projectId}
    entityType="work_order"
    entityId={workOrderId}
    currentUserId={userId}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/[locale]/dashboard/projects/[id]/work-orders/[workOrderId]/page.tsx
git commit -m "feat(work-orders): add comments to work order detail page"
```

---

## Task 11: Type-check, Lint, and Test

**Files:**
- All modified files

**Interfaces:**
- Consumes: All previous tasks
- Produces: Passing type-check, lint, and tests

- [ ] **Step 1: Run type-check**

Run: `cd /home/nac/Projects/construction-photo-log/web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run lint**

Run: `cd /home/nac/Projects/construction-photo-log/web && npm run lint`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `cd /home/nac/Projects/construction-photo-log/web && npm run test`
Expected: All tests pass

- [ ] **Step 4: Fix any issues**

If any step fails, fix the issues and re-run until all pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve type-check and lint issues"
```

---

## Verification Checklist

After completing all tasks, verify:

1. [ ] Database migration runs successfully
2. [ ] TypeScript types compile without errors
3. [ ] API routes return correct responses
4. [ ] Components render correctly
5. [ ] Comments can be created, read, deleted
6. [ ] @mentions trigger notifications
7. [ ] Real-time updates work
8. [ ] All tests pass
9. [ ] No lint errors
10. [ ] UI is in Macedonian
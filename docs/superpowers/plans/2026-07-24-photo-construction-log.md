# Photo Construction Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app for construction workers to photo-document building phases, organized by project, with PDF report export.

**Architecture:** Next.js 14+ App Router frontend, Supabase (PostgreSQL + Storage + Auth) for backend, Tailwind CSS + shadcn/ui for UI. A separate Python open-source package `photo-report-pdf` handles PDF generation.

**Tech Stack:** Next.js 14 (App Router), Supabase, Tailwind CSS, shadcn/ui, Vercel, Python 3.11+ (open-source package)

## Global Constraints

- No paid services at MVP stage — Supabase free tier, Vercel free tier
- Mobile-first responsive design (primary use case: phone camera)
- All text content in **Macedonian** (app UI + blog posts)
- Freemium model — no payment integration initially
- Python 3.11+ for open-source package
- Open-source packages published under MIT license

---

### Task 1: Project Scaffolding + Dependencies

**Files:**
- Create: `web/` (Next.js project root)
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.js`, `web/tailwind.config.ts`, `web/postcss.config.js`
- Create: `web/app/layout.tsx`, `web/app/globals.css`
- Create: `web/components/ui/` (shadcn/ui base)
- Create: `web/lib/supabase/client.ts`
- Create: `web/.env.local.example`

**Interfaces:**
- Consumes: nothing
- Produces: `supabase/client.ts` exports `createClient()` for browser-side Supabase access

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /home/nac/Projects/construction-photo-log
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd web
npm install @supabase/supabase-js @supabase/ssr
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select
npm install lucide-react
npm install date-fns
npm install class-variance-authority clsx tailwind-merge
npm install @types/node --save-dev
npx shadcn-ui@latest init -d
```

- [ ] **Step 3: Create Supabase browser client**

File: `web/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 5: Create globals.css with Tailwind + shadcn base**

Overwrite `web/app/globals.css` with shadcn/ui default styles.

- [ ] **Step 6: Set up root layout with metadata**

File: `web/app/layout.tsx` — set up HTML with Inter font, Macedonian lang (`lang="mk"`), metadata title "Фото Градежен Дневник".

- [ ] **Step 7: Install and configure Supabase CLI, init project**

```bash
npx supabase init
```

- [ ] **Step 8: Initialize git and commit**

```bash
cd /home/nac/Projects/construction-photo-log
git init
git add .
git commit -m "chore: initial scaffold with Next.js + Supabase + shadcn/ui"
```

---

### Task 2: Authentication (Supabase Auth)

**Files:**
- Create: `web/app/auth/callback/route.ts`
- Create: `web/app/login/page.tsx`
- Create: `web/app/signup/page.tsx`
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/supabase/middleware.ts`
- Create: `web/middleware.ts`
- Create: `web/components/AuthForm.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts`
- Produces: `createServerClient()` from `lib/supabase/server.ts`

- [ ] **Step 1: Create server-side Supabase client**

File: `web/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}
```

- [ ] **Step 2: Create middleware for session refresh**

File: `web/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  )
  await supabase.auth.getUser()
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

- [ ] **Step 3: Create AuthForm component**

File: `web/components/AuthForm.tsx` — a reusable form with email + password fields, handles login/signup, shows errors.

- [ ] **Step 4: Create Login page**

File: `web/app/login/page.tsx` — centered form, email + password, "Немаш сметка? Регистрирај се" link.

- [ ] **Step 5: Create Signup page**

File: `web/app/signup/page.tsx` — same layout, "Веќе имаш сметка? Најави се" link.

- [ ] **Step 6: Create auth callback route**

File: `web/app/auth/callback/route.ts` — handles OAuth redirect.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add Supabase auth with login/signup pages"
```

---

### Task 3: Database Schema + API Routes

**Files:**
- Create: `supabase/migrations/20260724000001_create_projects.sql`
- Create: `supabase/migrations/20260724000002_create_photos.sql`
- Create: `web/lib/supabase/queries.ts`
- Create: `web/types/database.ts`

**Interfaces:**
- Consumes: Supabase client from Task 1-2
- Produces:
  - `queries.ts`: `getProjects()`, `getProject(id)`, `createProject()`, `getPhotos(projectId)`, `createPhoto()`, `getPhoto(id)`
  - `database.ts`: TypeScript types for `Project`, `Photo`, `Report` tables

- [ ] **Step 1: Create projects migration**

File: `supabase/migrations/20260724000001_create_projects.sql`

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  client_name text,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can create own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Create photos migration**

File: `supabase/migrations/20260724000002_create_photos.sql`

```sql
create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  image_url text not null,
  taken_at timestamptz,
  latitude float,
  longitude float,
  note text,
  created_at timestamptz not null default now()
);

alter table photos enable row level security;

create policy "Users can view project photos"
  on photos for select
  using (
    exists (select 1 from projects where id = photos.project_id and user_id = auth.uid())
  );

create policy "Users can insert project photos"
  on photos for insert
  with check (
    exists (select 1 from projects where id = project_id and user_id = auth.uid())
  );

create policy "Users can delete project photos"
  on photos for delete
  using (
    exists (select 1 from projects where id = photos.project_id and user_id = auth.uid())
  );

create index photos_project_id_idx on photos(project_id);
create index photos_taken_at_idx on photos(taken_at);
```

- [ ] **Step 3: Create TypeScript type definitions**

File: `web/types/database.ts`

```typescript
export interface Project {
  id: string
  name: string
  address: string | null
  client_name: string | null
  user_id: string
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
}

export interface Report {
  id: string
  project_id: string
  title: string
  photo_ids: string[]
  generated_at: string
  pdf_url: string | null
}
```

- [ ] **Step 4: Create database query functions**

File: `web/lib/supabase/queries.ts` — wrapper functions for all CRUD operations using the Supabase client.

```typescript
import { createClient } from './client'
import type { Project, Photo } from '@/types/database'

export async function getProjects(): Promise<Project[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject(name: string, address?: string, client_name?: string): Promise<Project> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, address, client_name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function getPhotos(projectId: string): Promise<Photo[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('project_id', projectId)
    .order('taken_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createPhoto(
  projectId: string,
  imageUrl: string,
  takenAt?: string,
  latitude?: number,
  longitude?: number,
  note?: string
): Promise<Photo> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('photos')
    .insert({ project_id: projectId, image_url: imageUrl, taken_at: takenAt, latitude, longitude, note })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePhoto(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('photos').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 5: Set up Supabase storage bucket for photos**

```bash
# Via Supabase dashboard or CLI:
# Create bucket "photos", set to public read, RLS restricted insert
```

Record the bucket name as `photos` in project docs.

- [ ] **Step 6: Run migrations**

```bash
npx supabase db push
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add database schema for projects and photos"
```

---

### Task 4: Dashboard + Project CRUD UI

**Files:**
- Create: `web/app/dashboard/layout.tsx`
- Create: `web/app/dashboard/page.tsx`
- Create: `web/app/projects/new/page.tsx`
- Create: `web/app/projects/[id]/page.tsx`
- Create: `web/components/ProjectCard.tsx`
- Create: `web/components/Sidebar.tsx`
- Create: `web/components/Navbar.tsx`
- Modify: `web/app/layout.tsx` (add navigation)

- [ ] **Step 1: Create Navbar component**

File: `web/components/Navbar.tsx` — App name "Фото Градежен Дневник", user email, logout button. Mobile-friendly hamburger.

- [ ] **Step 2: Create Dashboard layout**

File: `web/app/dashboard/layout.tsx` — Navbar at top, main content area. Protected route (redirect to /login if not authenticated).

- [ ] **Step 3: Create Dashboard page**

File: `web/app/dashboard/page.tsx` — Grid of ProjectCards, "Нов проект" button. Fetches projects via `getProjects()`.

- [ ] **Step 4: Create ProjectCard component**

File: `web/components/ProjectCard.tsx` — Shows project name, address, client name, photo count, date. Click → `/projects/[id]`.

- [ ] **Step 5: Create New Project page**

File: `web/app/projects/new/page.tsx` — Form: Име на проект (required), Адреса, Клиент. Submits via `createProject()`. Redirects to dashboard.

- [ ] **Step 6: Create Project detail page (basic shell)**

File: `web/app/projects/[id]/page.tsx` — Project info header, tabs/preview area for photos (to be populated in Task 5-6). "Додади фотографија" button → upload page.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: dashboard and project CRUD UI"
```

---

### Task 5: Photo Upload with EXIF

**Files:**
- Create: `web/app/projects/[id]/upload/page.tsx`
- Create: `web/components/PhotoUpload.tsx`
- Create: `web/lib/exif.ts` (client-side EXIF extraction)
- Create: `web/app/api/upload/route.ts` (server upload handler)

- [ ] **Step 1: Create EXIF utility**

File: `web/lib/exif.ts` — extracts date/time and GPS from image file EXIF data using browser APIs. Falls back to current time if unavailable.

```typescript
export interface ExifData {
  takenAt: string | null
  latitude: number | null
  longitude: number | null
}

export async function extractExif(file: File): Promise<ExifData> {
  // Use browser FileReader + basic EXIF extraction
  // For MVP: use file.lastModified as takenAt fallback
  return {
    takenAt: new Date(file.lastModified).toISOString(),
    latitude: null,
    longitude: null,
  }
}
```

(Note: Full GPS EXIF extraction requires a library like `exifr`. For MVP, we use file metadata + manual GPS entry.)

- [ ] **Step 2: Create upload API route**

File: `web/app/api/upload/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('projectId') as string
  const note = formData.get('note') as string
  const takenAt = formData.get('takenAt') as string

  if (!file || !projectId) {
    return NextResponse.json({ error: 'Missing file or projectId' }, { status: 400 })
  }

  // Upload to Supabase Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${projectId}/${Date.now()}.${fileExt}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(fileName)

  // Insert photo record
  const { error: dbError } = await supabase
    .from('photos')
    .insert({
      project_id: projectId,
      image_url: publicUrl,
      taken_at: takenAt || null,
      note: note || null,
    })

  if (dbError) throw dbError

  return NextResponse.json({ success: true, url: publicUrl })
}
```

- [ ] **Step 3: Create PhotoUpload component**

File: `web/components/PhotoUpload.tsx` — Camera capture (via `<input type="file" accept="image/*" capture="environment">`), preview, note field, GPS manual entry. Shows upload progress.

- [ ] **Step 4: Create upload page**

File: `web/app/projects/[id]/upload/page.tsx` — Uses PhotoUpload component. On success, preview + "Додади уште" or "Назад кон проектот".

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: photo upload with EXIF extraction"
```

---

### Task 6: Timeline View

**Files:**
- Create: `web/components/PhotoTimeline.tsx`
- Create: `web/components/PhotoCard.tsx`
- Create: `web/app/projects/[id]/photos/page.tsx`
- Modify: `web/app/projects/[id]/page.tsx` (integrate timeline)

- [ ] **Step 1: Create PhotoCard component**

File: `web/components/PhotoCard.tsx` — Thumbnail, date, note, GPS (if available), delete button. Mobile-optimized card.

- [ ] **Step 2: Create PhotoTimeline component**

File: `web/components/PhotoTimeline.tsx` — Vertical timeline layout with dates as group headers. Accepts `photos: Photo[]`, renders PhotoCards grouped by date.

- [ ] **Step 3: Create photos sub-page**

File: `web/app/projects/[id]/photos/page.tsx` — Fetches photos via `getPhotos(projectId)`, renders PhotoTimeline.

- [ ] **Step 4: Update project detail page**

Modify `web/app/projects/[id]/page.tsx` — Add tabs or sections: "Фотографии" (timeline), "Извештај" (link to report). Show photo count + latest photo as preview.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: photo timeline view grouped by date"
```

---

### Task 7: PDF Report Generation

**Files:**
- Create: `web/app/projects/[id]/report/page.tsx`
- Create: `web/components/ReportBuilder.tsx`
- Create: `web/app/api/report/route.ts`
- Create: `packages/photo-report-pdf/` (Python package scaffold)
- Create: `packages/photo-report-pdf/src/photo_report_pdf/__init__.py`
- Create: `packages/photo-report-pdf/src/photo_report_pdf/generator.py`
- Create: `packages/photo-report-pdf/pyproject.toml`
- Create: `packages/photo-report-pdf/README.md`

- [ ] **Step 1: Create ReportBuilder component**

File: `web/components/ReportBuilder.tsx` — Select photos (checkboxes), enter title, "Генерирај PDF" button. Shows progress while generating.

- [ ] **Step 2: Create report page**

File: `web/app/projects/[id]/report/page.tsx` — Lists all project photos with checkboxes, ReportBuilder at top.

- [ ] **Step 3: Create Python package structure**

```bash
mkdir -p /home/nac/Projects/construction-photo-log/packages/photo-report-pdf/src/photo_report_pdf
```

- [ ] **Step 4: Create pyproject.toml**

File: `packages/photo-report-pdf/pyproject.toml`

```toml
[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "photo-report-pdf"
version = "0.1.0"
description = "Generate photo report PDFs for construction documentation"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.11"
dependencies = [
    "reportlab>=4.0",
    "pillow>=10.0",
]
```

- [ ] **Step 5: Create Python generator module**

File: `packages/photo-report-pdf/src/photo_report_pdf/generator.py`

```python
"""Generate PDF photo reports for construction documentation."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


@dataclass
class PhotoEntry:
    """A single photo entry in the report."""
    image_path: str
    caption: str = ""
    taken_at: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class Report:
    """Construction photo report data."""
    title: str = "Градежен фото извештај"
    project_name: str = ""
    client_name: str = ""
    address: str = ""
    generated_at: datetime = field(default_factory=datetime.now)
    photos: list[PhotoEntry] = field(default_factory=list)


class ReportGenerator:
    """Generates PDF photo reports for construction sites."""

    def __init__(self, report: Report):
        self.report = report
        self._page_width, self._page_height = A4
        self._margin = 20 * mm
        self._y = self._page_height - self._margin

    def generate(self, output_path: str | Path) -> Path:
        """Generate the PDF report and return the output path."""
        output_path = Path(output_path)
        c = canvas.Canvas(str(output_path), pagesize=A4)

        self._draw_header(c)
        self._draw_photos(c)
        c.save()
        return output_path

    def _draw_header(self, c: canvas.Canvas) -> None:
        c.setFont("Helvetica-Bold", 20)
        c.drawString(self._margin, self._y, self.report.title)
        self._y -= 12 * mm

        c.setFont("Helvetica", 11)
        if self.report.project_name:
            c.drawString(self._margin, self._y, f"Проект: {self.report.project_name}")
            self._y -= 6 * mm
        if self.report.client_name:
            c.drawString(self._margin, self._y, f"Клиент: {self.report.client_name}")
            self._y -= 6 * mm
        if self.report.address:
            c.drawString(self._margin, self._y, f"Адреса: {self.report.address}")
            self._y -= 6 * mm

        self._y -= 4 * mm
        date_str = self.report.generated_at.strftime("%d.%m.%Y %H:%M")
        c.setFont("Helvetica", 9)
        c.drawString(self._margin, self._y, f"Генерирано: {date_str}")
        self._y -= 10 * mm

    def _draw_photos(self, c: canvas.Canvas) -> None:
        img_max_w = self._page_width - 2 * self._margin
        img_max_h = 100 * mm

        for i, photo in enumerate(self.report.photos):
            # Check if we need a new page
            if self._y < 40 * mm:
                c.showPage()
                self._y = self._page_height - self._margin

            # Draw photo number
            c.setFont("Helvetica-Bold", 12)
            c.drawString(self._margin, self._y, f"Фотографија {i + 1}")
            self._y -= 8 * mm

            # Draw image
            try:
                img = Image.open(photo.image_path)
                img_w, img_h = img.size
                ratio = min(img_max_w / img_w, img_max_h / img_h)
                draw_w = img_w * ratio
                draw_h = img_h * ratio
                c.drawImage(photo.image_path, self._margin, self._y - draw_h, width=draw_w, height=draw_h)
                self._y -= draw_h + 4 * mm
            except Exception:
                c.setFont("Helvetica", 10)
                c.drawString(self._margin, self._y, "[Сликата не може да се вчита]")
                self._y -= 8 * mm

            # Draw caption + metadata
            if photo.caption:
                c.setFont("Helvetica", 10)
                c.drawString(self._margin, self._y, photo.caption)
                self._y -= 5 * mm

            if photo.taken_at:
                c.setFont("Helvetica", 8)
                c.drawString(self._margin, self._y, f"Сликано: {photo.taken_at.strftime('%d.%m.%Y %H:%M')}")
                self._y -= 4 * mm

            if photo.latitude and photo.longitude:
                c.setFont("Helvetica", 8)
                c.drawString(self._margin, self._y, f"GPS: {photo.latitude:.6f}, {photo.longitude:.6f}")
                self._y -= 4 * mm

            self._y -= 8 * mm
```

- [ ] **Step 6: Create package __init__.py**

File: `packages/photo-report-pdf/src/photo_report_pdf/__init__.py`

```python
from .generator import Report, PhotoEntry, ReportGenerator

__all__ = ["Report", "PhotoEntry", "ReportGenerator"]
```

- [ ] **Step 7: Create README.md for the package**

File: `packages/photo-report-pdf/README.md` — Macedonian + English. Пример за користење, API документација, линк до веб апликацијата.

- [ ] **Step 8: Create report API route (web app calls Python)**

File: `web/app/api/report/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, photoIds, title } = await request.json()

  // Fetch photo records
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .in('id', photoIds)

  if (!photos) return NextResponse.json({ error: 'Photos not found' }, { status: 404 })

  // Download images to temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-'))
  const entries: any[] = []

  for (const photo of photos) {
    const ext = path.extname(new URL(photo.image_url).pathname) || '.jpg'
    const localPath = path.join(tmpDir, `${photo.id}${ext}`)
    const response = await fetch(photo.image_url)
    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(localPath, buffer)
    entries.push({
      image_path: localPath,
      caption: photo.note || '',
      taken_at: photo.taken_at,
      latitude: photo.latitude,
      longitude: photo.longitude,
    })
  }

  // Call Python script
  const scriptPath = path.join(process.cwd(), '../packages/photo-report-pdf/src/photo_report_pdf/cli.py')
  const outputPath = path.join(tmpDir, 'report.pdf')
  const inputJson = JSON.stringify({ title, projectId, photos: entries, output_path: outputPath })
  const inputFile = path.join(tmpDir, 'input.json')
  fs.writeFileSync(inputFile, inputJson)

  try {
    execSync(`python3 ${scriptPath} --input ${inputFile}`, { timeout: 30000 })
  } catch (e: any) {
    return NextResponse.json({ error: `PDF generation failed: ${e.message}` }, { status: 500 })
  }

  // Upload PDF to Supabase Storage
  const pdfBuffer = fs.readFileSync(outputPath)
  const pdfFileName = `${user.id}/${projectId}/report-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(pdfFileName, pdfBuffer, { contentType: 'application/pdf' })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(pdfFileName)

  // Clean up temp files
  fs.rmSync(tmpDir, { recursive: true, force: true })

  return NextResponse.json({ success: true, pdf_url: publicUrl })
}
```

- [ ] **Step 9: Create CLI entry point for Python package**

File: `packages/photo-report-pdf/src/photo_report_pdf/cli.py`

```python
"""CLI entry point for photo-report-pdf."""

import json
import sys
from datetime import datetime
from pathlib import Path

from .generator import PhotoEntry, Report, ReportGenerator


def main():
    args = sys.argv[1:]
    if len(args) != 2 or args[0] != "--input":
        print("Usage: python -m photo_report_pdf.cli --input <input.json>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(args[1])
    data = json.loads(input_path.read_text())

    photos = []
    for p in data.get("photos", []):
        taken_at = None
        if p.get("taken_at"):
            taken_at = datetime.fromisoformat(p["taken_at"])
        photos.append(PhotoEntry(
            image_path=p["image_path"],
            caption=p.get("caption", ""),
            taken_at=taken_at,
            latitude=p.get("latitude"),
            longitude=p.get("longitude"),
        ))

    report = Report(
        title=data.get("title", "Градежен фото извештај"),
        photos=photos,
    )

    generator = ReportGenerator(report)
    output = generator.generate(data["output_path"])
    print(json.dumps({"success": True, "output": str(output)}))


if __name__ == "__main__":
    main()
```

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: PDF report generation with Python package"
```

---

### Task 8: Landing Page + SEO

**Files:**
- Create: `web/app/page.tsx` (landing page, overwrite default)
- Create: `web/components/HeroSection.tsx`
- Create: `web/components/FeaturesSection.tsx`
- Create: `web/components/CTASection.tsx`

- [ ] **Step 1: Create HeroSection component**

File: `web/components/HeroSection.tsx` — Наслов: "Фотографирај. Документирај. Заштити се." Subtitle, "Започни бесплатно" CTA button.

- [ ] **Step 2: Create FeaturesSection component**

File: `web/components/FeaturesSection.tsx` — 3-4 feature cards: Автоматско датирање, GPS локација, PDF извештај, Team колаборација. Icons from lucide-react.

- [ ] **Step 3: Create CTASection component**

File: `web/components/CTASection.tsx` — Final CTA with "Регистрирај се бесплатно" button.

- [ ] **Step 4: Assemble Landing page**

File: `web/app/page.tsx`

```typescript
import HeroSection from '@/components/HeroSection'
import FeaturesSection from '@/components/FeaturesSection'
import CTASection from '@/components/CTASection'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <CTASection />
    </main>
  )
}
```

Add SEO metadata:

```typescript
export const metadata = {
  title: 'Фото Градежен Дневник | Документирај ги твоите градилишта',
  description: 'Апликација за градежна фото документација. Сликај, организирај по проекти, генерирај PDF извештаи за инспекција.',
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: landing page with SEO metadata"
```

---

### Task 9: Polish + First Deployment

**Files:**
- Create: `web/vercel.json`
- Modify: `README.md` (project root)
- Modify: `web/app/error.tsx` (error boundary)

- [ ] **Step 1: Create vercel.json**

```json
{
  "framework": "nextjs"
}
```

- [ ] **Step 2: Create root README.md**

File: `/home/nac/Projects/construction-photo-log/README.md` — На македонски: што е проектот, tech stack, како да се стартува локално.

- [ ] **Step 3: Create error boundary**

File: `web/app/error.tsx` — User-friendly error page во македонски.

- [ ] **Step 4: Run type check and build**

```bash
cd web
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: polish and deploy prep"
```

---

### Task 10: Open Source Python Package (Complete Release)

**Files:**
- Create: `packages/photo-report-pdf/tests/`
- Create: `packages/photo-report-pdf/tests/test_generator.py`
- Create: `packages/photo-report-pdf/Makefile`
- Create: `packages/photo-report-pdf/.github/workflows/publish.yml`

- [ ] **Step 1: Install Python dependencies and test**

```bash
cd packages/photo-report-pdf
pip install -e ".[dev]"
```

- [ ] **Step 2: Create test file**

File: `packages/photo-report-pdf/tests/test_generator.py` — Tests for ReportGenerator with mock images.

- [ ] **Step 3: Create Makefile**

```makefile
.PHONY: test build publish

test:
	pytest tests/ -v

build:
	python -m build

publish:
	python -m twine upload dist/*
```

- [ ] **Step 4: Create GitHub CI workflow**

File: `packages/photo-report-pdf/.github/workflows/publish.yml` — PyPI publish on tag push.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: complete open-source Python package with CI"
```

---

### Task 11: Blog Posts (Content Marketing)

**Files:**
- Create: `web/app/blog/page.tsx`
- Create: `web/app/blog/[slug]/page.tsx`
- Create: `web/content/blog/1-greski.md`
- Create: `web/content/blog/2-dnevnik-checklist.md`
- Create: `web/content/blog/3-inspekcija.md`
- Create: `web/content/blog/4-reklamacija.md`

- [ ] **Step 1: Create blog list page**

File: `web/app/blog/page.tsx` — List of blog posts with titles, summaries, dates.

- [ ] **Step 2: Create blog post page (dynamic)**

File: `web/app/blog/[slug]/page.tsx` — Renders markdown content with SEO metadata.

- [ ] **Step 3: Write Blog Post 1**

File: `web/content/blog/1-greski.md`

```markdown
---
title: "3 скапи грешки што можеше да ги спречи една фотографија"
date: "2026-07-28"
description: "Како недостатокот на фото документација чини пари на градежните изведувачи"
---

Содржина... (во Македонски)
```

- [ ] **Step 4: Write Blog Post 2**

File: `web/content/blog/2-dnevnik-checklist.md` — "Како да направите градежен дневник со фотографии"

- [ ] **Step 5: Write Blog Post 3**

File: `web/content/blog/3-inspekcija.md` — "Што треба да содржи фото документација за инспекција?"

- [ ] **Step 6: Write Blog Post 4**

File: `web/content/blog/4-reklamacija.md` — "Рекламација? Како да докажете дека работата е коректно изведена"

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: blog with 4 SEO-optimized posts in Macedonian"
```

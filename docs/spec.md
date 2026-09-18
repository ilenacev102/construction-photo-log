# Spec: Photo Construction Log

> Градежен фото дневник — сликај, документирај, генерирај PDF извештај.

**Датум:** 2026-07-24  
**Статус:** Draft  
**Верзија:** 0.1

---

## 1. Краток опис

Web апликација за градежници/изведувачи/надзорници за фотографска документација на градилишта. Корисникот слика фази од градба, апликацијата автоматски запишува датум, време, GPS локација и проект, и на крај може да генерира PDF извештај.

---

## 2. Problems & User Stories

### Проблем
- Работниците сликаат со телефон, сликите се губат/мешаат
- Нема доказ кога и што е направено при рекламации
- Инспекциите бараат уредна фото документација
- При правење PDF извештај, треба рачно да се средуваат слики

### User Stories
| # | Како | Сакам да | За да |
|---|------|----------|-------|
| 1 | Градежен изведувач | Сликам фаза и автоматски да се зачува со датум/проект | Имам доказ кога е завршено |
| 2 | Надзорник | Видам сите фотографии од проект подредени по датум | Проверам напредок |
| 3 | Инженер | Генерирам PDF извештај за инспекција | Имам уредна документација |
| 4 | Изведувач | Поканет team member да додава слики | Не морам сам да сликам се |

---

## 3. MVP Feature Set

### Core (MVP)
1. **Authentication** — Login/Register (email + Google)
2. **Projects** — CRUD проекти (име, адреса, клиент)
3. **Photos** — Upload преку камера/галерија со auto EXIF (датум, GPS)
4. **Timeline view** — Фотографии подредени по датум, филтрирани по проект
5. **PDF Report** — Еден клик → PDF со сите слики + датуми + коментари

### Post-MVP
1. Team invites (повеќе корисници на проект)
2. Коментари на слики
3. Офлајн режим (mobile app)
4. Прилагоден PDF шаблон (лого на фирма)
5. QR код на градилиште за брз пристап

---

## 4. Tech Stack

| Слој | Технологија | Зошто |
|------|------------|-------|
| **Frontend** | Next.js 14+ (App Router) | SSR за SEO, мобилно-адаптивен, Vercel deploy |
| **Backend/DB** | Supabase | PostgreSQL + Storage за слики + Auth (готово) |
| **PDF** | Open source пакет (Node.js) | Ќе го направиме како GitHub repo за marketing |
| **Deployment** | Vercel (frontend) + Supabase (backend) | Бесплатен tier за старт |
| **CSS** | Tailwind CSS + shadcn/ui | Брз development |

---

## 5. Data Model

```
Project
  id: uuid
  name: string
  address: string
  client_name: string
  created_at: timestamp
  user_id: uuid (FK)

Photo
  id: uuid
  project_id: uuid (FK → Project)
  image_url: string (Supabase Storage)
  taken_at: timestamp (од EXIF или upload)
  latitude: float (од EXIF)
  longitude: float (од EXIF)
  note: text (optional)
  created_at: timestamp

Report
  id: uuid
  project_id: uuid (FK → Project)
  title: string
  include_photos: uuid[] (Photo IDs)
  generated_at: timestamp
  pdf_url: string (Supabase Storage)
```

---

## 6. UI / Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing page | Што е ова + Free trial CTA |
| `/login` | Login | Auth |
| `/dashboard` | Dashboard | Преглед на проекти |
| `/projects/new` | New project | Креирање проект |
| `/projects/[id]` | Project detail | Timeline со фотографии |
| `/projects/[id]/upload` | Upload photo | Камера/галерија + note |
| `/projects/[id]/report/new` | Generate report | Избор на слики → PDF |
| `/projects/[id]/report/[id]` | Report view | Преглед на готов PDF |

---

## 7. Open Source стратегија

**Пакет 1: `photo-report-pdf`** (Node.js)
- Генерира PDF од фотографии + метаподатоци
- Примери во README за градежништво
- GitHub repo со stars → контрибуции → SEO

**Пакет 2: `exif-organizer`** (Node.js)
- Екстракт на EXIF податоци (датум, GPS)
- Форматирање за градежна документација

Овие пакети се **free-standing open source** — не бараат account. Програмерите ги користат директно, а README-то содржи линк до апликацијата.

---

## 8. Marketing / Blog план

| # | Наслов | Target keyword | Цел |
|---|--------|---------------|-----|
| 1 | "3 скапи грешки што можеше да ги спречи една фотографија" | градежна документација, фото дневник градилиште | Емоција + болка |
| 2 | "Како да направите градежен дневник со фотографии (чек-листа)" | градежен дневник, фотодокументација градилиште | Вредност |
| 3 | "Што да содржи фото документација за инспекција?" | инспекција градилиште, градежна инспекција | SEO |
| 4 | "Рекламација? Како да докажете дека работата е коректна" | рекламација градежни работи, доказ | Страв + решение |

---

## 9. Roadmap

| Phase | Траење | Што |
|-------|--------|-----|
| **Phase 1: Core MVP** | 2-3 недели | Auth, проекти, upload, timeline, PDF |
| **Phase 2: Open Source** | 1 недела | `photo-report-pdf` пакет на GitHub |
| **Phase 3: Content** | континуирано | 4 blog post-а, LinkedIn, FB групи |
| **Phase 4: Iterate** | ongoing | Team invites, коментари, feedback |

---

## 10. Open Questions

1. 🤔 Дали да почнеме со web app (mobile-friendly) или native mobile app?
2. 🤔 Првиот open source пакет да биде во Node.js или Python?
3. 🤔 Payment — Stripe или само Freemium без плаќање на почеток?

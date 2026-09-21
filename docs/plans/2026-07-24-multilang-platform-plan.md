# Повеќејазична Платформа — План за Имплементација

> **За извршители:** Користете `superpowers:subagent-driven-development` за имплементација задача по задача. Чекорите користат `- [ ]` синтакса за следење.

**Цел:** Целосна повеќејазична поддршка (German, English, Macedonian, Slovenian, Serbian) + клучни функционални подобрувања за апликацијата Фото Градежен Дневник.

**Архитектура:** next-intl со префикс-базирано рутирање (`/de`, `/en`, `/mk`, `/sl`, `/sr`) – сите постоечки рути се обвиткуваат во `[locale]` динамички сегмент. Сите UI стрингови се преместуваат во JSON преводни датотеки. Датумите се форматираат преку next-intl (не date-fns locale). PDF генераторот добива `language` параметар.

**Tech Stack:** Next.js 16, `next-intl` (v4+), `exifr` (за GPS), Leaflet (за мапа), Supabase, Python ReportLab, Tailwind CSS, shadcn/ui

---

## Состојба во Моментов (Current State)

### Што работи ✅
- **Аутентикација**: Login/Signup преку Supabase SSR (само MK)
- **Проекти**: CRUD (име, адреса, клиент) (само MK)
- **Фотографии**: Upload во Supabase Storage (bucket: `construction-photos`), timeline grouped by date (само MK)
- **PDF Извештај**: Python CLI (`photo-report-pdf`) со ReportLab (само MK натписи)
- **Блог**: 4 статии во `content/blog/` (само MK)
- **Landing Page**: Hero, Features, CTA секции (само MK)
- **База**: Supabase таблици `projects`, `photos` со RLS

### Проблеми / Празнини 🔧
1. **Јазик**: 100% hardcoded Macedonian — нема i18n, `html lang="mk"` фиксно
2. **Middleware**: `middleware.ts` има `setAll: () => {}` no-op (deprecated за Next.js 16)
3. **EXIF**: Само `file.lastModified` — нема вистинска GPS/EXIF екстракција
4. **Датуми**: `date-fns/locale/mk` — само македонски, нема locale switching
5. **PDF**: Сите натписи на македонски („Проект:", „Клиент:", „Сликано:" итн.)
6. **Мета податоци**: `layout.tsx` metadata е само на македонски
7. **Блог**: Сите посте се само на македонски
8. **Недостига**: Daily Log функционалност, GPS мапа, превземање на податоци

---

## План по Фази

### Фаза 0: Фондација — i18n Framework
**Го поставува next-intl и ги подготвува сите страници за повеќејазичност.**

#### Task 0.1: Инсталација и конфигурација на next-intl

**Фајлови:**
- Modify: `web/package.json`
- Create: `web/messages/de.json`, `web/messages/en.json`, `web/messages/mk.json`, `web/messages/sl.json`, `web/messages/sr.json`
- Create: `web/i18n/request.ts`
- Create: `web/i18n/routing.ts`
- Create: `web/i18n/navigation.ts`
- Modify: `web/next.config.ts`
- Create: `web/middleware.ts` (препиши)

- [ ] **Step 1: Инсталирај next-intl**

```bash
cd /home/nac/Projects/construction-photo-log/web
npm install next-intl@latest
```

- [ ] **Step 2: Креирај `i18n/routing.ts` — дефинирај ги 5-те јазици**

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['de', 'en', 'mk', 'sl', 'sr'],
  defaultLocale: 'mk',
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]
```

- [ ] **Step 3: Креирај `i18n/request.ts` — динамичко вчитување на преводи**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 4: Креирај `i18n/navigation.ts` — type-safe navigation helpers**

```typescript
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

- [ ] **Step 5: Препиши `middleware.ts` — користи next-intl middleware**

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

- [ ] **Step 6: Ажурирај `next.config.ts` — додај `next-intl/plugin`**

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  /* config options here */
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 7: Смени `app/layout.tsx` — dynamic locale, додај `<NextIntlClientProvider>`**

Layout-от треба да прими `params: Promise<{ locale: string }>`, да го користи `NextIntlClientProvider` и `html lang={locale}`.

```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} dir="ltr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Премести ги сите страници во `app/[locale]/` директориум**

Сите постоечки рути:
- `app/page.tsx` → `app/[locale]/page.tsx`
- `app/login/page.tsx` → `app/[locale]/login/page.tsx`
- `app/signup/page.tsx` → `app/[locale]/signup/page.tsx`
- `app/dashboard/` → `app/[locale]/dashboard/`
- `app/projects/` → `app/[locale]/projects/`
- `app/blog/` → `app/[locale]/blog/`
- `app/api/` останува на `app/api/` (не е локализирано)
- `app/auth/` останува на `app/auth/` (не е локализирано)

Измени ги сите `import` на `Link` од `next/link` на `@/i18n/navigation`.
Измени ги сите `import` на `useRouter`, `usePathname` од `next/navigation` на `@/i18n/navigation`.

- [ ] **Step 9: Додај catch-all `not-found.tsx` за 404 на секој јазик**

---

### Фаза 0.5: Преведувачки Датотеки

#### Task 0.5: Креирај ги почетните преводни JSON датотеки

Оваа задача ги создава сите 5 JSON датотеки со сите стрингови за целата апликација. Секој стринг има клуч според компонентата.

**Фајлови:**
- Create: `web/messages/mk.json` (македонски — default, најкомплетен)
- Create: `web/messages/de.json` (германски)
- Create: `web/messages/en.json` (англиски)
- Create: `web/messages/sl.json` (словенечки)
- Create: `web/messages/sr.json` (српски)

**Структура на клучевите:**

```json
{
  "navbar": {
    "appName": "Фото Градежен Дневник",
    "logout": "Одјави се",
    "menuOpen": "Отвори мени",
    "menuClose": "Затвори мени"
  },
  "hero": {
    "line1": "Фотографирај.",
    "line2": "Документирај.",
    "line3": "Заштити се.",
    "description": "Внесете го вашето градилиште во дигитална ера...",
    "tagline": "Без хартија. Без забуни. Без ризик.",
    "ctaStart": "Започни бесплатно",
    "ctaLogin": "Најави се"
  },
  "features": {
    "title": "Зошто фото документација?",
    "subtitle": "Заштитете се од неосновани тврдења...",
    "autoDate": { "title": "Автоматско датирање", "desc": "..." },
    "gps": { "title": "GPS локација", "desc": "..." },
    "pdf": { "title": "PDF извештај", "desc": "..." },
    "team": { "title": "Тимска работа", "desc": "..." }
  },
  "cta": {
    "title": "Започни да документираш денес",
    "subtitle": "Бесплатно. Без обврски. За 1 минута.",
    "button": "Регистрирај се бесплатно"
  },
  "auth": {
    "login": "Најава",
    "signup": "Регистрација",
    "email": "Е-пошта",
    "emailPlaceholder": "your@email.com",
    "password": "Лозинка",
    "passwordPlaceholder": "••••••••",
    "loginButton": "Најави се",
    "signupButton": "Регистрирај се",
    "loading": "Се вчитува...",
    "noAccount": "Немаш сметка?",
    "hasAccount": "Веќе имаш сметка?",
    "registerLink": "Регистрирај се",
    "loginLink": "Најави се",
    "successTitle": "Проверете ја вашата е-пошта за потврда.",
    "successDesc": "Ви испративме линк за потврда на вашата сметка."
  },
  "dashboard": {
    "title": "Мои проекти",
    "subtitle": "Управувајте со вашите градежни проекти",
    "newProject": "+ Нов проект",
    "emptyTitle": "Сеуште немате проекти",
    "emptyDesc": "Креирајте го вашиот прв проект за да започнете.",
    "emptyButton": "+ Креирај проект",
    "errorAuth": "Немате пристап. Најавете се повторно."
  },
  "projectCard": {
    "client": "Клиент: {name}",
    "created": "Создадено на {date}"
  },
  "projectDetail": {
    "back": "Назад кон проекти",
    "address": "Адреса:",
    "client": "Клиент:",
    "created": "Создадено:",
    "photos": "Фотографии: {count}",
    "addPhoto": "+ Додади фотографија",
    "generateReport": "Генерирај извештај",
    "allPhotos": "Сите фотографии",
    "noPhotos": "Сеуште нема додадено фотографии.",
    "addFirst": "+ Додади прва фотографија",
    "notFound": "Проектот не е пронајден",
    "photoCount": "{count} фотографи{count === 1 ? 'ја' : 'и'}"
  },
  "photoUpload": {
    "title": "Додади фотографија",
    "subtitle": "Прикачи фотографија од градилиштето.",
    "dropzone": "Прикачи фотографија",
    "dropzoneHint": "Притисни за да избереш или фотографираш",
    "noteLabel": "Напомена / опис",
    "notePlaceholder": "Внеси опис на фотографијата (опционално)...",
    "uploadButton": "Прикачи",
    "uploading": "Прикачување...",
    "cancel": "Откажи",
    "successTitle": "Фотографијата е прикачена",
    "successDesc": "Фотографијата е успешно додадена кон проектот.",
    "addMore": "+ Додади уште",
    "back": "Назад кон проектот",
    "previewAlt": "Преглед",
    "error": "Грешка при прикачување",
    "errorUpload": "Грешка при прикачување"
  },
  "photoTimeline": {
    "noPhotos": "Сè уште нема фотографии"
  },
  "photoCard": {
    "alt": "Фотографија",
    "gps": "ГПС: {lat}, {lng}",
    "deleteLabel": "Избриши фотографија",
    "delete": "Избриши"
  },
  "report": {
    "title": "Генерирај извештај",
    "reportTitle": "Наслов на извештај",
    "titlePlaceholder": "Внеси наслов на извештајот...",
    "selected": "{count} од {total} избрани",
    "selectAll": "Избери ги сите",
    "deselectAll": "Отстрани ги сите",
    "noNote": "Без опис",
    "error": "Грешка при генерирање на PDF",
    "generating": "Генерирање...",
    "generate": "Генерирај PDF",
    "successTitle": "PDF извештајот е генериран",
    "downloadPDF": "Превземи PDF",
    "back": "Назад кон проектот",
    "backToList": "← Назад кон проекти"
  },
  "blog": {
    "title": "Блог",
    "subtitle": "Совети, водичи и најдобри практики за градежна фото документација.",
    "empty": "Сеуште нема објавено статии.",
    "readMore": "Прочитај повеќе",
    "back": "Назад кон блог",
    "notFound": "Не е пронајдена",
    "notFoundTitle": "Не е пронајдена | Фото Градежен Дневник"
  },
  "common": {
    "error": "Настана грешка",
    "loading": "Се вчитува...",
    "save": "Зачувај",
    "cancel": "Откажи",
    "delete": "Избриши"
  },
  "newProject": {
    "title": "Нов проект",
    "subtitle": "Пополнете ги деталите за да креирате нов градежен проект.",
    "nameLabel": "Име на проект",
    "nameRequired": "*",
    "namePlaceholder": "Пр. Доградба на куќа",
    "addressLabel": "Адреса",
    "addressPlaceholder": "Пр. Ул. Македонија бр. 10",
    "clientLabel": "Име на клиент",
    "clientPlaceholder": "Пр. Петар Петровски",
    "submit": "Креирај проект",
    "submitting": "Се креира...",
    "cancel": "Откажи",
    "back": "Назад кон проекти",
    "error": "Настана грешка"
  },
  "photosPage": {
    "title": "Фотографии",
    "total": "Вкупно {count} фотографи{count === 1 ? 'ја' : 'и'}",
    "add": "Додади",
    "back": "← Назад кон проектот",
    "error": "Грешка при бришење:"
  },
  "languageSwitcher": {
    "label": "Јазик",
    "de": "Deutsch",
    "en": "English",
    "mk": "Македонски",
    "sl": "Slovenščina",
    "sr": "Српски"
  },
  "metadata": {
    "homeTitle": "Фото Градежен Дневник | Документирај ги твоите градилишта",
    "homeDesc": "Апликација за градежна фото документација. Сликај, организирај по проекти, генерирај PDF извештаи за инспекција.",
    "loginTitle": "Најава — Фото Градежен Дневник",
    "signupTitle": "Регистрација — Фото Градежен Дневник",
    "dashboardTitle": "Табла — Фото Градежен Дневник",
    "blogTitle": "Блог | Фото Градежен Дневник",
    "blogDesc": "Совети и водичи за градежна фото документација, инспекција и градежен дневник."
  }
}
```

Секој јазик добива свој JSON со истите клучеви, но преведени вредности.

- [ ] **Step 1: Креирај `web/messages/mk.json` — комплетен, сите клучеви**
- [ ] **Step 2: Креирај `web/messages/en.json` — преведено на англиски**
- [ ] **Step 3: Креирај `web/messages/de.json` — преведено на германски**
- [ ] **Step 4: Креирај `web/messages/sl.json` — преведено на словенечки**
- [ ] **Step 5: Креирај `web/messages/sr.json` — преведено на српски**

---

### Фаза 1: UI Translation (Компонента по Компонента)

#### Task 1.1: Navbar — преведи на сите јазици

**Фајлови:**
- Modify: `web/components/Navbar.tsx`

**Промени:** Сите MK стрингови → `useTranslations('navbar')`

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from './LanguageSwitcher'

interface NavbarProps {
  userEmail: string
}

export default function Navbar({ userEmail }: NavbarProps) {
  const t = useTranslations('navbar')
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          {t('appName')}
        </Link>
        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-sm text-muted-foreground">{userEmail}</span>
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            {t('logout')}
          </Button>
        </div>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? t('menuClose') : t('menuOpen')}
        >
          {/* hamburger SVG */}
          ...
        </button>
      </div>
      {menuOpen && (
        <div className="border-t border-border bg-background px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-3">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              {t('logout')}
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}
```

#### Task 1.2: Language Switcher компонента

**Фајлови:**
- Create: `web/components/LanguageSwitcher.tsx`

```typescript
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition } from 'react'

export default function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchLanguage(nextLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  const locales = [
    { code: 'de', label: t('de') },
    { code: 'en', label: t('en') },
    { code: 'mk', label: t('mk') },
    { code: 'sl', label: t('sl') },
    { code: 'sr', label: t('sr') },
  ]

  return (
    <select
      value={locale}
      onChange={(e) => switchLanguage(e.target.value)}
      disabled={isPending}
      className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none"
      aria-label={t('label')}
    >
      {locales.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
```

#### Task 1.3: Landing Page — HeroSection, FeaturesSection, CTASection

**Фајлови:**
- Modify: `web/components/HeroSection.tsx`
- Modify: `web/components/FeaturesSection.tsx`
- Modify: `web/components/CTASection.tsx`

Сите `useTranslations('hero')`, `useTranslations('features')`, `useTranslations('cta')`.

HeroSection станува `'use client'` (поради `useTranslations` на клиент).

#### Task 1.4: AuthForm + auth страници

**Фајлови:**
- Modify: `web/components/AuthForm.tsx`
- Modify: `web/app/[locale]/login/page.tsx`
- Modify: `web/app/[locale]/signup/page.tsx`

AuthForm користи `useTranslations('auth')`. Свич на `Link` од `@/i18n/navigation`.

#### Task 1.5: Dashboard + ProjectCard

**Фајлови:**
- Modify: `web/app/[locale]/dashboard/page.tsx`
- Modify: `web/app/[locale]/dashboard/layout.tsx`
- Modify: `web/components/ProjectCard.tsx`

Dashboard користи `useTranslations('dashboard')`, `Link` од `@/i18n/navigation`.
ProjectCard користи `useTranslations('projectCard')`.

#### Task 1.6: Project Detail + Upload страници

**Фајлови:**
- Modify: `web/app/[locale]/projects/[id]/page.tsx`
- Modify: `web/app/[locale]/projects/new/page.tsx`
- Modify: `web/app/[locale]/projects/[id]/upload/page.tsx`
- Modify: `web/components/PhotoUpload.tsx`

#### Task 1.7: Photos Timeline + PhotoCard

**Фајлови:**
- Modify: `web/app/[locale]/projects/[id]/photos/page.tsx`
- Modify: `web/components/PhotoTimeline.tsx`
- Modify: `web/components/PhotoCard.tsx`

PhotoTimeline и PhotoCard треба да примат locale проп или да користат `useLocale()` од `next-intl` за date formatting наместо `date-fns/locale/mk`. Користи `format(date, 'dd MMM yyyy')` од `date-fns` со `useLocale()` од `@/i18n/navigation` за да го избереш вистинскиот locale.

Всушност, подобро: користи `useTranslations` со параметри и `Intl.DateTimeFormat` за сите датуми — не треба date-fns locale.

```typescript
const locale = useLocale()
const dateStr = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(date)
```

#### Task 1.8: Report Builder + Report страница

**Фајлови:**
- Modify: `web/app/[locale]/projects/[id]/report/page.tsx`
- Modify: `web/components/ReportBuilder.tsx`

#### Task 1.9: Blog страници

**Фајлови:**
- Modify: `web/app/[locale]/blog/page.tsx`
- Modify: `web/app/[locale]/blog/[slug]/page.tsx`

---

### Фаза 1.5: Мета Податоци и SEO

#### Task 1.10: Dynamic metadata per language

**Фајлови:**
- Modify: `web/app/[locale]/layout.tsx` (dynamic `generateMetadata`)
- Modify сите страници со `metadata` export → `generateMetadata`

Секоја страница генерира динамички мета врз основа на `params.locale` и `messages.metadata.*`.

---

### Фаза 2: PDF Генератор — Повеќејазичен

#### Task 2.1: Додај language parameter во PDF генераторот

**Фајлови:**
- Modify: `packages/photo-report-pdf/src/photo_report_pdf/generator.py`
- Modify: `packages/photo-report-pdf/src/photo_report_pdf/cli.py`
- Test: `packages/photo-report-pdf/tests/test_generator.py`

**Промени:** Додај `language: str = "mk"` поле во `Report` dataclass. Креирај речник за секој поддржан јазик:

```python
LABELS = {
    "mk": {
        "report_title": "Градежен фото извештај",
        "project": "Проект:",
        "client": "Клиент:",
        "address": "Адреса:",
        "generated": "Генерирано:",
        "photo_label": "Фотографија",
        "captured": "Сликано:",
        "gps": "GPS:",
        "image_error": "[Сликата не може да се вчита]",
    },
    "en": {
        "report_title": "Construction Photo Report",
        "project": "Project:",
        "client": "Client:",
        "address": "Address:",
        "generated": "Generated:",
        "photo_label": "Photo",
        "captured": "Captured:",
        "gps": "GPS:",
        "image_error": "[Image could not be loaded]",
    },
    "de": {
        "report_title": "Bau-Fotobericht",
        "project": "Projekt:",
        "client": "Kunde:",
        "address": "Adresse:",
        "generated": "Erstellt:",
        "photo_label": "Foto",
        "captured": "Aufgenommen:",
        "gps": "GPS:",
        "image_error": "[Bild konnte nicht geladen werden]",
    },
    "sl": {
        "report_title": "Gradbeno foto poročilo",
        "project": "Projekt:",
        "client": "Stranka:",
        "address": "Naslov:",
        "generated": "Ustvarjeno:",
        "photo_label": "Fotografija",
        "captured": "Posneto:",
        "gps": "GPS:",
        "image_error": "[Slike ni mogoče naložiti]",
    },
    "sr": {
        "report_title": "Građevinski foto izveštaj",
        "project": "Projekt:",
        "client": "Klijent:",
        "address": "Adresa:",
        "generated": "Generisano:",
        "photo_label": "Fotografija",
        "captured": "Snimljeno:",
        "gps": "GPS:",
        "image_error": "[Slike nije moguće učitati]",
    },
}
```

Сите `drawString` повици користат `self._labels[key]` наместо hardcoded strings.

CLI-то прима `language` поле во JSON input.

#### Task 2.2: Ажурирај го API route-то да праќа language

**Фајлови:**
- Modify: `web/app/api/report/route.ts`

Прими `language` од телото на барањето и прати го во CLI JSON input.

#### Task 2.3: ReportBuilder додај language selection

**Фајлови:**
- Modify: `web/components/ReportBuilder.tsx`

Додај dropdown за избор на јазик на извештајот, праќај го во API-то.

---

### Фаза 3: Функционални Подобрувања

#### Task 3.1: Вистинска GPS/EXIF екстракција

**Фајлови:**
- Modify: `web/package.json` (додај `exifr`)
- Modify: `web/lib/exif.ts`

Користи `exifr` за вистинска EXIF екстракција (датум + GPS координати):

```typescript
import exifr from 'exifr'

export async function extractExif(file: File): Promise<ExifData> {
  try {
    const data = await exifr.parse(file, {
      exif: true,
      gps: true,
      xmp: false,
      icc: false,
      iptc: false,
      tiff: false,
      interop: false,
    })

    return {
      takenAt: data?.DateTimeOriginal?.toISOString() ?? new Date(file.lastModified).toISOString(),
      latitude: data?.latitude ?? null,
      longitude: data?.longitude ?? null,
    }
  } catch {
    return {
      takenAt: new Date(file.lastModified).toISOString(),
      latitude: null,
      longitude: null,
    }
  }
}
```

#### Task 3.2: GPS Map View на Photo Timeline

**Фајлови:**
- Create: `web/components/PhotoMap.tsx`
- Modify: `web/app/[locale]/projects/[id]/page.tsx` (додај картичка/таб)
- Modify: `web/package.json` (додај `leaflet`, `@types/leaflet`)

Прикажи ги сите фотографии со GPS координати на Leaflet мапа (without API key). Користи OpenStreetMap tiles. Маркери со popup што ја прикажуваат фотографијата и датумот.

#### Task 3.3: Daily Log функционалност

**Фајлови:**
- Create: `supabase/migrations/20260725000003_create_daily_logs.sql`
- Modify: `web/types/database.ts` (додај `DailyLog` тип)
- Create: `web/app/[locale]/projects/[id]/daily-log/page.tsx`
- Create: `web/components/DailyLogForm.tsx`
- Create: `web/components/DailyLogTimeline.tsx`
- Modify: `web/lib/supabase/queries.ts` (CRUD за daily logs)

**SQL миграција:**

```sql
CREATE TABLE daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weather text,
  temperature text,
  work_description text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily logs"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily logs"
  ON daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily logs"
  ON daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily logs"
  ON daily_logs FOR DELETE
  USING (auth.uid() = user_id);
```

Daily Log формата вклучува: датум, време, временски услови, температура, опис на работата, белешки (повеќејазично).

#### Task 3.4: Блог постови на сите 5 јазици

**Фајлови:**
- Create: `web/content/blog/de/*.md` (4 статии)
- Create: `web/content/blog/en/*.md` (4 статии)
- Create: `web/content/blog/sl/*.md` (4 статии)
- Create: `web/content/blog/sr/*.md` (4 статии)
- Modify: `web/app/[locale]/blog/page.tsx` (локализиран content path)
- Modify: `web/app/[locale]/blog/[slug]/page.tsx` (локализиран content path)
- Modify: `web/lib/blog.ts` (accept locale parameter, read from `content/blog/{locale}/`)

Реструктурирај `content/blog/` во `content/blog/{locale}/*.md`. Blog.ts зема `locale` параметар и чита од соодветниот директориум.

---

### Фаза 4: Префинетост и Деплој

#### Task 4.1: Sitemap генерирање

**Фајлови:**
- Create: `web/app/[locale]/sitemap.ts`

Генерирај sitemap со сите јазични варијанти и `hreflang` тагови.

#### Task 4.2: robots.txt

**Фајлови:**
- Create: `web/app/robots.ts`

#### Task 4.3: Vercel деплој подготовка

- Провери `vercel.json`
- Постави environment variables
- `npm run build` тест

#### Task 4.4: Тестирање на целата платформа

- Проверка на сите 5 јазици
- Проверка на PDF на сите јазици
- Проверка на датум формати
- Проверка на auth flow
- Проверка на upload flow
- Проверка на responsive дизајн

---

## Резиме на Task-ови

| # | Task | Фајлови | Приоритет |
|---|------|---------|-----------|
| 0.1 | next-intl инсталација + конфиг | 7 | 🚨 Висок |
| 0.5 | Преводни JSON датотеки (5×) | 5 | 🚨 Висок |
| 1.1 | Navbar превод | 1 | 🚨 Висок |
| 1.2 | Language Switcher | 1 | 🚨 Висок |
| 1.3 | Landing Page (Hero, Features, CTA) | 3 | 🚨 Висок |
| 1.4 | AuthForm + auth страници | 3 | 🚨 Висок |
| 1.5 | Dashboard + ProjectCard | 3 | 🚨 Висок |
| 1.6 | Project Detail + Upload + New | 4 | 🚨 Висок |
| 1.7 | Photos Timeline + PhotoCard | 3 | 🚨 Висок |
| 1.8 | Report Builder + Report страница | 2 | 🚨 Висок |
| 1.9 | Blog страници | 2 | 🚨 Висок |
| 1.10 | Динамички metadata/SEO | 8+ | 🚨 Висок |
| 2.1 | PDF generator — повеќејазичен | 3 | ⚡ Среден |
| 2.2 | API route — language parameter | 1 | ⚡ Среден |
| 2.3 | ReportBuilder — language selection | 1 | ⚡ Среден |
| 3.1 | Вистинска GPS EXIF екстракција | 2 | 🔥 Важен |
| 3.2 | GPS Map View | 3 | 🔥 Важен |
| 3.3 | Daily Log функционалност | 6 | 🔥 Важен |
| 3.4 | Блог постови на 5 јазици | 4+ | ⚡ Среден |
| 4.1 | Sitemap | 1 | 🟢 Нормален |
| 4.2 | robots.txt | 1 | 🟢 Нормален |
| 4.3 | Vercel подготовка | — | 🟢 Нормален |
| 4.4 | Тестирање | — | 🟢 Нормален |

---

## Зависности помеѓу Task-ови

```
0.1 (next-intl) → 0.5 (JSON files) → 1.1–1.10 (UI преводи) → 2.1–2.3 (PDF)
                                                             → 3.1–3.4 (Features)
                                                             → 4.1–4.4 (Polish)

3.1 (GPS EXIF) → 3.2 (GPS Map)
3.3 (Daily Log) → самостоен (може паралелно со 3.1–3.2)
3.4 (Blog) → може паралелно со 1.9
```

**Паралелно извршување:**
- Task 1.3–1.9 (UI компоненти) може да се извршуваат паралелно откако 0.1 и 0.5 се готови
- Task 2.1–2.3 (PDF) може паралелно со Task 3.1–3.4 (Features)
- Task 1.9 и 3.4 (Blog) се поврзани — прво 1.9, па 3.4

---

## Како да се Почне

1. **Прво**: Инсталирај next-intl (0.1) и креирај ги преводните датотеки (0.5)
2. **Потоа**: Преведи ги компонентите (1.1–1.10) — почни со Navbar + LanguageSwitcher
3. **Паралелно**: Работи на PDF (2.x) и Features (3.x)
4. **На крај**: Polish + deploy (4.x)

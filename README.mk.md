# Фото Градежен Дневник

Веб апликација за фото документација на градежни објекти. Сликајте, организирајте по проекти и генерирајте PDF извештаи за инспекција — со дефекти, работни налози, присуство, дневни извештаи и QR-верификација на автентичност.

## Технолошки стек

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (37 рути), Supabase (автентикација + Postgres + Storage)
- **PDF Извештаи:** генерирани во `web/lib/pdf/` со pdfkit
- **i18n:** 5 локали (mk, en, de, sl, sr) — македонскиот е изворен

## Функционалности

- 📸 Прикачување фотографии со EXIF (GPS + датум), компресија и thumbnails
- 🏗️ Организација по градежни проекти со улоги (admin, site_manager, foreman, photographer, client)
- 🐞 Дефекти (kanban), 🔧 работни налози и нивно поврзување
- 📋 Дневни извештаи, ⏱️ присуство (check-in/out), 📌 пинови на цртежи
- 💬 Коментари со @mentions и нотификации
- 🏷️ Етикети и групи на етикети по компанија
- 📄 PDF извештаи со QR-код за независна верификација (`/verify/[manifestId]`)
- 📊 Admin-контролен центар (статистика, audit-логови, управување со тим)
- 🗺️ GPS мапа, временска линија, календар и timelapse приказ
- 🌙 Темен режим, PWA со offline outbox

## Локален развој

```bash
cd web
npm install
cp .env.local.example .env.local   # Пополнете ги Supabase акредитивите
npm run dev          # развоен сервер
npm run type-check   # проверка на типови
npm run lint         # линтување
npm run test         # тестови (Vitest)
```

## Структура на проектот

```
├── web/                          # Next.js апликација
│   ├── app/                      # App Router страници + API рути
│   │   ├── api/                  # 37 серверски рути (валидација, RBAC, rate-limit)
│   │   └── [locale]/             # Локализирани страници (dashboard, projects, admin…)
│   ├── components/               # React компоненти (ui, admin, defects, labels…)
│   ├── hooks/                    # Домeнски hooks (defects, pins, attendance…)
│   ├── lib/                      # Серверска логика (api, auth, pdf, storage, evidence…)
│   ├── messages/                 # Преводи (mk, en, de, sl, sr)
│   └── docs/adr/                 # Архитектонски одлуки
├── supabase/migrations/          # Верзионирана Postgres шема + RLS политики
└── docs/                         # Спецификации, планови и аудит-извештаи
```

## Безбедносен модел (накратко)

Company-scoped multi-tenancy (RLS + проверки во рути), RBAC хиерархија,
allowlist за PATCH полиња, rate-limit на сите мутации, audit-трага и
tamper-evident манифести за извештаите. Детали: `web/AGENTS.md`.

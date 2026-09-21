# Self-hosting

Three paths, from zero effort to full control.

## Option A — Use the hosted instance (fastest)

Open the production URL, sign up, create your first project. No setup.
Best for trying the product or running a small crew without ops work.

## Option B — Self-host with Supabase Cloud (recommended)

1. Create a free project at [supabase.com](https://supabase.com) (Postgres +
   Auth + Storage are all used).
2. Link the CLI and push the schema (44+ migrations create tables, RLS
   policies, storage buckets and the realtime publication):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
3. In Supabase Dashboard → Authentication → Sign In / Up, enable the
   Email provider. (Optional) set Site URL to your app URL.
4. Deploy `web/` to Vercel (root directory `web/`, framework Next.js) with
   env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your public URL — drives sitemap/robots/QR links)
5. Sign up in the app, then bootstrap the first admin in Supabase SQL editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@company.com');
   ```
   New signups default to role `photographer`; admins assign the rest from
   Admin → Team.

## Option C — Fully local (development)

Requires Docker (Supabase local stack) and Node 22+:

```bash
cd web
npm install
cp .env.local.example .env.local   # point at local or cloud Supabase
npx supabase start                  # local Postgres + Auth + Storage
npx supabase db push                # same 44+ migrations
npm run dev
```

Run the gates before every push:

```bash
npm run type-check && npm run lint && npm run test
```

## Notes

- Storage buckets (`construction-photos`, `schemas`) are created by
  migration `20260724000003` — no manual bucket setup needed.
- Realtime for comments/notifications is enabled by migration
  `20260825130000` (Postgres publication, no extra config).
- File uploads cap at 20 MB per photo (server-enforced).

import { createServerClient } from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 *
 * Responsibilities:
 * 1. Refresh Supabase auth sessions — call getUser() and propagate new
 *    Set-Cookie headers when the access token has been refreshed.
 * 2. API route auth guard — return 401 JSON for unauthenticated /api/ requests.
 * 3. App route auth guard — redirect to login for unauthenticated app routes.
 * 4. Internationalization — run next-intl locale negotiation/rewrites on top
 *    of the Supabase session cookies so root-level routes (`/`, `/login`)
 *    resolve into the `[locale]` tree instead of 404ing, and locale-prefixed
 *    default-locale paths redirect to their canonical unprefixed form.
 *
 * Static assets (_next/static, _next/image, favicon.ico, etc.) are excluded
 * via the matcher so the proxy never blocks them.
 */

// Paths that never require authentication
const PUBLIC_API_PATHS = ['/api/auth', '/api/health', '/api/verify']

// next-intl middleware built from the shared routing config. It internally
// rewrites unprefixed paths to the default locale (/ -> /mk), 307-redirects
// prefixed default-locale paths to their canonical form (/mk -> /), and
// serves non-default locales directly (/en -> /en).
const intlMiddleware = createMiddleware(routing)

/**
 * Removes a leading locale segment from a pathname when present, so auth
 * checks run against the locale-agnostic path.
 * e.g. "/mk/login" -> "/login", "/en/dashboard" -> "/dashboard",
 * "/dashboard" -> "/dashboard".
 */
function stripLocalePrefix(pathname: string): string {
  const firstSegment = pathname.split('/')[1] ?? ''
  if (
    routing.locales.some(
      (locale) => locale.toLowerCase() === firstSegment.toLowerCase(),
    )
  ) {
    return pathname.slice(firstSegment.length + 1) || '/'
  }
  return pathname
}

async function createProxyClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name }) => request.cookies.delete(name))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  return { supabase, supabaseResponse }
}

/**
 * Core proxy function — runs before every matched route.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Create Supabase client & refresh session ──────────────────────
  const { supabase, supabaseResponse } = await createProxyClient(request)

  // getUser() refreshes the session if the access token is expired
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const isAuthenticated = !error && user !== null

  // ── 2. API route auth guard ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Allow public API paths (auth callbacks, health checks)
    if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
      return supabaseResponse
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    return supabaseResponse
  }

  // ── 3. App route auth guard ─────────────────────────────────────────
  // Public app routes (locale-agnostic) that don't require login.
  const relativePath = stripLocalePrefix(pathname)
  const isPublicAppRoute =
    relativePath === '/' ||
    relativePath === '/login' ||
    relativePath === '/signup' ||
    relativePath === '/auth' ||
    relativePath === '/verify' ||
    relativePath.startsWith('/verify/') ||
    relativePath.startsWith('/login/') ||
    relativePath.startsWith('/signup/') ||
    relativePath.startsWith('/auth/')

  if (!isAuthenticated && !isPublicAppRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    // Propagate refreshed session cookies onto the redirect — otherwise a
    // token refreshed during this request is lost and the next request
    // re-authenticates from the stale cookie (flaky "logout" symptom).
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // ── 4. Root-level (non-localized) routes — skip intl ────────────────
  // Next-intl would rewrite e.g. /auth/callback to /mk/auth/callback (404),
  // so OAuth callback routes bypass locale negotiation entirely.
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // ── 5. Internationalization ─────────────────────────────────────────
  // Resolve locale, rewrite unprefixed routes into the [locale] tree and
  // apply canonical redirects. New session cookies from step 1 must be
  // copied onto the intl response (including its redirects) so refreshed
  // tokens survive the locale round-trip.
  const intlResponse = intlMiddleware(request)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie)
  })
  return intlResponse
}

// Matcher must stay a static inline literal — Next.js cannot statically parse a variable reference here.
export const config = {
  matcher: [
    /*
     * Run on every request except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - files with extensions (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.).*)',
  ],
}
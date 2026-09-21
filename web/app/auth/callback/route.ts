import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  // The canonical dashboard resolves the authenticated user's role on the
  // server, so email confirmation and magic links land in the right workspace.
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Validate redirect target — only allow same-origin relative paths.
  // Rejects absolute URLs, protocol-relative ("//host"), backslash tricks
  // ("/\evil.com") and any embedded scheme (security: prevent open redirect).
  const isSafeNext =
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.includes('\\') &&
    !rawNext.includes('://')
  const next = isSafeNext ? rawNext : '/'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            const header = request.headers.get('cookie') ?? ''
            return header.split(';').map((c) => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            }).filter((c) => c.name)
          },
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  if (token_hash && type) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            const header = request.headers.get('cookie') ?? ''
            return header.split(';').map((c) => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            }).filter((c) => c.name)
          },
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink',
      token_hash,
    })
    if (!error) {
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication+failed`)
}

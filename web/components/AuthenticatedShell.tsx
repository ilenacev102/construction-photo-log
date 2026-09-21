import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'

/**
 * Shared authenticated shell (Navbar + main). Used by the dashboard and
 * projects layouts, which were byte-identical duplicates.
 */
export default async function AuthenticatedShell({
  children,
  locale,
}: {
  children: React.ReactNode
  locale: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect({ href: '/login', locale })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar userEmail={user?.email ?? ''} />
      <main className="min-w-0 w-full flex-1 overflow-x-clip">{children}</main>
    </div>
  )
}

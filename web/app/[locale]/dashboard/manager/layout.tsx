import { redirect } from '@/i18n/navigation'
import { getCurrentWorkspace } from '@/lib/auth/workspace'

export default async function ManagerWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, role } = await getCurrentWorkspace()

  if (!user) redirect({ href: '/login', locale })
  if (role !== 'site_manager' && role !== 'admin') redirect({ href: '/dashboard', locale })

  return children
}

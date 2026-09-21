import { redirect } from '@/i18n/navigation'
import { getCurrentWorkspace } from '@/lib/auth/workspace'

export default async function FieldWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, role } = await getCurrentWorkspace()

  if (!user) redirect({ href: '/login', locale })
  // Admins may enter to try the field experience; mutations stay governed
  // by API role gates, so nothing privileged leaks through viewing.
  if (role !== 'photographer' && role !== 'foreman' && role !== 'admin') {
    redirect({ href: '/dashboard', locale })
  }

  return children
}

import { redirect } from '@/i18n/navigation'
import { getCurrentWorkspace, workspacePath } from '@/lib/auth/workspace'

/**
 * Canonical authenticated entry point.
 * A user never has to choose a dashboard: their server-validated role selects it.
 * Admins land on the normal manager dashboard (the everyday platform) — the
 * admin panel stays one click away in the navbar.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, workspace } = await getCurrentWorkspace()

  if (!user) redirect({ href: '/login', locale })
  if (workspace === 'admin') redirect({ href: workspacePath.manager, locale })
  redirect({ href: workspacePath[workspace], locale })
}

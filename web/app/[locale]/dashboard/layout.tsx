import AuthenticatedShell from '@/components/AuthenticatedShell'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <AuthenticatedShell locale={locale}>{children}</AuthenticatedShell>
}

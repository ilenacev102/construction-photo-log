'use client'

import { useTranslations } from 'next-intl'
import { ScrollText, Tag, Users, UsersRound, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Every href here MUST resolve to a real page under app/[locale] — the
// rendered-link invariant test in ./__tests__/quick-operations.test.tsx
// fails the build otherwise. There was a /admin/billing tile with no page
// behind it for months (P1-21); billing needs a payment provider first.
type OperationKey = 'users' | 'team' | 'auditLog' | 'labels'

const QUICK_OPERATIONS: Array<{ key: OperationKey; href: string; icon: LucideIcon }> = [
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'team', href: '/admin/team', icon: UsersRound },
  { key: 'auditLog', href: '/admin/audit', icon: ScrollText },
  { key: 'labels', href: '/admin/labels', icon: Tag },
]

function QuickOperations() {
  const t = useTranslations('admin.commandCenter.quickOps')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
          {QUICK_OPERATIONS.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              aria-label={t(key)}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'min-w-0 h-auto flex-col gap-1.5 py-3.5 text-center',
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="text-xs leading-snug">{t(key)}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { QuickOperations }

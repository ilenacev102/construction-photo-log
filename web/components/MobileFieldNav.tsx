'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { Camera, Image as ImageIcon, AlertTriangle, Map, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileFieldNavProps {
  projectId: string
}

export default function MobileFieldNav({ projectId }: MobileFieldNavProps) {
  const pathname = usePathname()

  const items = [
    {
      href: `/projects/${projectId}`,
      label: 'Log',
      icon: Calendar,
      active: pathname === `/projects/${projectId}`,
    },
    {
      href: `/projects/${projectId}/photos`,
      label: 'Photos',
      icon: ImageIcon,
      active: pathname === `/projects/${projectId}/photos`,
    },
    {
      href: `/projects/${projectId}/upload`,
      label: 'Capture',
      icon: Camera,
      active: pathname === `/projects/${projectId}/upload`,
      highlight: true,
    },
    {
      href: `/projects/${projectId}/defects`,
      label: 'Defects',
      icon: AlertTriangle,
      active: pathname === `/projects/${projectId}/defects`,
    },
    {
      href: `/projects/${projectId}/schema`,
      label: 'Plan',
      icon: Map,
      active: pathname === `/projects/${projectId}/schema`,
    },
  ]

  return (
    <nav
      aria-label="Mobile field navigation"
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-border-strong bg-surface-raised/95 px-2 py-1.5 shadow-elevation-3 backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center rounded-xs px-2.5 py-1 text-[10px] font-medium transition-colors duration-150',
                item.active
                  ? 'text-accent font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
                item.highlight &&
                  'rounded-full bg-accent text-accent-foreground px-3 py-1.5 font-bold shadow-xs hover:bg-accent-hover',
              )}
            >
              <Icon className={cn('size-4', item.highlight && 'size-4 text-accent-foreground')} />
              <span className={cn('mt-0.5', item.highlight && 'text-[9px] font-bold')}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

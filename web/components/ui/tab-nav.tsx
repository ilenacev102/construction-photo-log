import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

interface Tab {
  key: string
  href: string
}

interface TabNavProps {
  tabs: Tab[]
  pathname: string
  labels: Record<string, string>
  ariaLabel: string
  basePath?: string
  className?: string
}

function TabNav({ tabs, pathname, labels, ariaLabel, basePath, className }: TabNavProps) {
  const isActive = ({ href }: Tab) =>
    pathname === href || (href !== basePath && pathname.startsWith(`${href}/`))

  return (
    <nav
      data-slot="tab-nav"
      aria-label={ariaLabel}
      className={cn("flex min-w-0 gap-1 overflow-x-auto", className)}
    >
      {tabs.map((tab) => {
        const active = isActive(tab)
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-xs px-3.5 py-1.5 text-xs font-semibold transition-all duration-180 ease-apple-spring whitespace-nowrap",
              active
                ? "bg-accent-muted/40 text-accent font-semibold"
                : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
            )}
          >
            {labels[tab.key]}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export { TabNav }

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  variant?: "default" | "divider"
  className?: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const isDivider = variant === "divider"

  return (
    <div
      data-slot="stat-card"
      className={cn(
        isDivider
          ? "min-w-0 border-l border-border bg-surface-raised p-5 first:border-l-0"
          : "rounded-md border border-border bg-surface-raised p-4 shadow-elevation-1 transition-all duration-180 ease-apple-spring hover:border-accent hover:shadow-elevation-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-semibold uppercase text-muted-foreground",
            isDivider ? "text-[11px] tracking-[0.08em]" : "text-xs tracking-[0.08em]"
          )}
        >
          {label}
        </p>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      <p
        className={cn(
          "text-3xl font-semibold tracking-tight tabular-nums",
          isDivider ? "mt-4" : "mt-2 min-w-0 break-words text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}

export { StatCard }

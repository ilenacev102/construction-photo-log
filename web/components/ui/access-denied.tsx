import { Lock } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

interface AccessDeniedProps {
  title: string
  description: string
  backHref: string
  backLabel: string
  className?: string
}

function AccessDenied({
  title,
  description,
  backHref,
  backLabel,
  className,
}: AccessDeniedProps) {
  return (
    <div
      data-slot="access-denied"
      className={cn("flex flex-col items-center justify-center py-20 text-center", className)}
    >
      <Lock className="mb-4 size-12 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <Link
        href={backHref}
        className="mt-4 -m-1.5 inline-block rounded-sm p-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {backLabel}
      </Link>
    </div>
  )
}

export { AccessDenied }

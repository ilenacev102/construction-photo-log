import { cn } from "@/lib/utils"

function LoadingBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="loading-block"
      role="status"
      className={cn("flex items-center justify-center py-20", className)}
      {...props}
    >
      <div className="size-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
    </div>
  )
}

export { LoadingBlock }

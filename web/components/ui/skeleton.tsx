import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-surface-sunken/80',
        className,
      )}
      {...props}
    />
  )
}

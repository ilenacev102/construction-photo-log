import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message?: string
  children?: React.ReactNode
  className?: string
  onDismiss?: () => void
  dismissLabel?: string
}

function ErrorAlert({ message, children, className, onDismiss, dismissLabel }: ErrorAlertProps) {
  return (
    <div
      data-slot="error-alert"
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive',
        className
      )}
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{children ?? message}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="shrink-0 rounded-sm p-0.5 text-destructive/70 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

export { ErrorAlert }

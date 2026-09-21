/**
 * Application Monitoring and Error Tracking.
 *
 * Provides a unified interface for capturing errors and diagnostic messages.
 * Integrates with Sentry / external error monitoring services when SENTRY_DSN or
 * NEXT_PUBLIC_SENTRY_DSN is configured, with safe console logging fallback in development.
 */

export interface ErrorContext {
  userId?: string
  projectId?: string
  url?: string
  extra?: Record<string, unknown>
}

class MonitoringService {
  private dsn: string | null = null
  private environment: string

  constructor() {
    this.dsn =
      process.env.NEXT_PUBLIC_SENTRY_DSN ||
      process.env.SENTRY_DSN ||
      null
    this.environment = process.env.NODE_ENV || 'development'
  }

  public isEnabled(): boolean {
    return Boolean(this.dsn)
  }

  /**
   * Capture an unhandled exception or error.
   */
  public captureException(error: unknown, context?: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error))

    // Always log to console in non-test environments
    if (this.environment !== 'test') {
      console.error('[Monitoring] Exception captured:', {
        message: err.message,
        stack: err.stack,
        context,
        timestamp: new Date().toISOString(),
      })
    }

    if (!this.dsn) {
      return
    }

    // If Sentry SDK or HTTP webhook is available, dispatch here
    try {
      if (typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureException: (e: unknown, ctx?: unknown) => void } }).Sentry) {
        ;(window as unknown as { Sentry: { captureException: (e: unknown, ctx?: unknown) => void } }).Sentry.captureException(err, { extra: context })
      }
    } catch {
      // Ignore monitoring transmission failures to prevent cascading errors
    }
  }

  /**
   * Capture a diagnostic warning or informational message.
   */
  public captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext,
  ): void {
    if (this.environment !== 'test') {
      console.log(`[Monitoring][${level.toUpperCase()}] ${message}`, context)
    }
  }
}

export const monitoring = new MonitoringService()

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodically clean up stale entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove records older than 10 minutes
      record.timestamps = record.timestamps.filter((ts) => now - ts < 10 * 60 * 1000)
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    ;(cleanupInterval as { unref: () => void }).unref()
  }
}

export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTimeMs: number
  retryAfterSec: number
}

/**
 * Check if an identifier exceeds rate limits within a sliding window.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  let record = rateLimitStore.get(identifier)
  if (!record) {
    record = { timestamps: [] }
    rateLimitStore.set(identifier, record)
  }

  // Filter timestamps within the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart)

  if (record.timestamps.length >= config.limit) {
    const oldestTimestamp = record.timestamps[0]
    const resetTimeMs = oldestTimestamp + config.windowMs
    const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - now) / 1000))

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTimeMs,
      retryAfterSec,
    }
  }

  // Record this request
  record.timestamps.push(now)
  const remaining = Math.max(0, config.limit - record.timestamps.length)
  const resetTimeMs = now + config.windowMs

  return {
    success: true,
    limit: config.limit,
    remaining,
    resetTimeMs,
    retryAfterSec: 0,
  }
}

/**
 * Extract client IP from NextRequest.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}

/**
 * Helper to build a 429 Too Many Requests response with RFC rate limit headers.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  customMessage?: string,
): NextResponse {
  const message =
    customMessage ||
    `Премногу барања. Обидете се повторно за ${result.retryAfterSec} секунди.`

  return NextResponse.json(
    {
      data: null,
      error: message,
    },
    {
      status: 429,
      headers: {
        'Retry-After': result.retryAfterSec.toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTimeMs / 1000).toString(),
      },
    },
  )
}

/**
 * Clear the internal store (useful for test setup/teardown).
 */
export function clearRateLimits(): void {
  rateLimitStore.clear()
}

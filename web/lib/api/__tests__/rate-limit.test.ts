import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, clearRateLimits, getClientIp, rateLimitResponse } from '../rate-limit'
import { NextRequest } from 'next/server'

describe('checkRateLimit', () => {
  beforeEach(() => {
    clearRateLimits()
  })

  it('allows requests within the limit', () => {
    const config = { limit: 3, windowMs: 1000 }
    const r1 = checkRateLimit('user1', config)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = checkRateLimit('user1', config)
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = checkRateLimit('user1', config)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('blocks requests exceeding the limit', () => {
    const config = { limit: 2, windowMs: 10000 }
    checkRateLimit('user2', config)
    checkRateLimit('user2', config)

    const r3 = checkRateLimit('user2', config)
    expect(r3.success).toBe(false)
    expect(r3.remaining).toBe(0)
    expect(r3.retryAfterSec).toBeGreaterThanOrEqual(1)
  })

  it('tracks different users independently', () => {
    const config = { limit: 1, windowMs: 10000 }
    const u1 = checkRateLimit('user-a', config)
    expect(u1.success).toBe(true)

    const u2 = checkRateLimit('user-b', config)
    expect(u2.success).toBe(true)

    const u1Blocked = checkRateLimit('user-a', config)
    expect(u1Blocked.success).toBe(false)
  })

  it('generates a 429 response with proper headers', async () => {
    const result = {
      success: false,
      limit: 5,
      remaining: 0,
      resetTimeMs: Date.now() + 30000,
      retryAfterSec: 30,
    }
    const resp = rateLimitResponse(result)
    expect(resp.status).toBe(429)
    expect(resp.headers.get('Retry-After')).toBe('30')
    expect(resp.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(resp.headers.get('X-RateLimit-Remaining')).toBe('0')
    const body = await resp.json()
    expect(body).toEqual({
      data: null,
      error: 'Премногу барања. Обидете се повторно за 30 секунди.',
    })
  })

  it('extracts client IP properly from headers', () => {
    const reqWithForwarded = new NextRequest('http://localhost:3000/api/report', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    })
    expect(getClientIp(reqWithForwarded)).toBe('203.0.113.195')

    const reqWithRealIp = new NextRequest('http://localhost:3000/api/report', {
      headers: { 'x-real-ip': '198.51.100.1' },
    })
    expect(getClientIp(reqWithRealIp)).toBe('198.51.100.1')
  })
})

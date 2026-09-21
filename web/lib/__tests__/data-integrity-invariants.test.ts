import { describe, it, expect } from 'vitest'

// ============================================================================
// Pure models of the DB invariants in
// 20260914000001_add_data_integrity_invariants.sql
// ============================================================================

/**
 * Model of CHECK constraint `photos_latitude_range`:
 * `CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))`.
 * The column is a nullable float — NULL is allowed.
 */
function isLatitudeValid(latitude: number | null): boolean {
  return latitude === null || (latitude >= -90 && latitude <= 90)
}

/**
 * Model of CHECK constraint `photos_longitude_range`:
 * `CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))`.
 * The column is a nullable float — NULL is allowed.
 */
function isLongitudeValid(longitude: number | null): boolean {
  return longitude === null || (longitude >= -180 && longitude <= 180)
}

/**
 * Model of CHECK constraint `comments_body_not_blank`:
 * `CHECK (length(trim(body)) > 0)`.
 * The column is `text NOT NULL`, so the model takes a string and only
 * rejects bodies that are empty or whitespace-only after trimming.
 */
function isBodyNonBlank(body: string): boolean {
  return body.trim().length > 0
}

/**
 * Documented Stripe subscription statuses. Source: web/docs/pricing.md and
 * web/lib/subscriptions/pricing.ts. The hand-written free=5/500 limits are
 * canonical; plan_limits.generated.sql treats free as unlimited (see report).
 */
const VALID_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
] as const

/**
 * Model of CHECK constraint `subscriptions_status_valid`:
 * `CHECK (status IN ('active', 'trialing', 'past_due', 'canceled',
 * 'unpaid', 'incomplete', 'incomplete_expired'))`.
 * The column is `text NOT NULL DEFAULT 'active'`.
 */
function isValidSubscriptionStatus(status: string): boolean {
  return (VALID_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
}

describe('data integrity invariants (DB constraints expressed as pure helpers)', () => {
  describe('photos.latitude range (photos_latitude_range)', () => {
    it('accepts NULL (column is nullable)', () => {
      expect(isLatitudeValid(null)).toBe(true)
    })

    it('accepts the inclusive lower bound -90', () => {
      expect(isLatitudeValid(-90)).toBe(true)
    })

    it('accepts the inclusive upper bound 90', () => {
      expect(isLatitudeValid(90)).toBe(true)
    })

    it('accepts values inside the range', () => {
      expect(isLatitudeValid(0)).toBe(true)
      expect(isLatitudeValid(41.9981)).toBe(true)
      expect(isLatitudeValid(-33.8688)).toBe(true)
    })

    it('rejects values below -90', () => {
      expect(isLatitudeValid(-90.0001)).toBe(false)
    })

    it('rejects values above 90', () => {
      expect(isLatitudeValid(90.0001)).toBe(false)
    })
  })

  describe('photos.longitude range (photos_longitude_range)', () => {
    it('accepts NULL (column is nullable)', () => {
      expect(isLongitudeValid(null)).toBe(true)
    })

    it('accepts the inclusive lower bound -180', () => {
      expect(isLongitudeValid(-180)).toBe(true)
    })

    it('accepts the inclusive upper bound 180', () => {
      expect(isLongitudeValid(180)).toBe(true)
    })

    it('accepts values inside the range', () => {
      expect(isLongitudeValid(0)).toBe(true)
      expect(isLongitudeValid(21.4285)).toBe(true)
      expect(isLongitudeValid(-122.4194)).toBe(true)
    })

    it('rejects values below -180', () => {
      expect(isLongitudeValid(-180.0001)).toBe(false)
    })

    it('rejects values above 180', () => {
      expect(isLongitudeValid(180.0001)).toBe(false)
    })
  })

  describe('comments.body non-blank (comments_body_not_blank)', () => {
    it('accepts a normal non-empty body', () => {
      expect(isBodyNonBlank('Фотографија од темелите')).toBe(true)
    })

    it('accepts a body that is non-empty after trimming', () => {
      expect(isBodyNonBlank('  текст  ')).toBe(true)
    })

    it('rejects an empty string', () => {
      expect(isBodyNonBlank('')).toBe(false)
    })

    it('rejects a whitespace-only body', () => {
      expect(isBodyNonBlank('   ')).toBe(false)
      expect(isBodyNonBlank('\t\n ')).toBe(false)
    })
  })

  describe('subscriptions.status documented Stripe list (subscriptions_status_valid)', () => {
    it('accepts every documented status', () => {
      for (const status of VALID_SUBSCRIPTION_STATUSES) {
        expect(isValidSubscriptionStatus(status)).toBe(true)
      }
    })

    it('rejects an undocumented status', () => {
      expect(isValidSubscriptionStatus('expired')).toBe(false)
      expect(isValidSubscriptionStatus('paused')).toBe(false)
    })

    it('rejects an empty string', () => {
      expect(isValidSubscriptionStatus('')).toBe(false)
    })

    it('rejects a status with surrounding whitespace (exact match only)', () => {
      expect(isValidSubscriptionStatus(' active')).toBe(false)
      expect(isValidSubscriptionStatus('active ')).toBe(false)
    })
  })
})
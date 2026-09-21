import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'construction-photos'

const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/construction-photos\/(.+)/

/**
 * In-process cache of generated signed URLs.
 *
 * Signed URLs are valid for `expiresIn` seconds, so a URL minted for a path
 * can be reused for the rest of its lifetime instead of hitting the storage
 * API again. This kills the N+1 pattern in API routes that sign the same
 * photo set on every request (e.g. GET /api/photos). Entries expire a safety
 * margin before the underlying URL does.
 *
 * Keyed by `${expiresIn}:${path}` so a 5-minute report URL is never reused
 * where a 1-hour one is expected (and vice-versa).
 */
const signedUrlCache = new Map<
  string,
  { url: string; expiresAt: number }
>()

// Upper bound so the in-process cache cannot grow without limit on
// long-lived servers; oldest entries are evicted first (Map preserves
// insertion order).
const MAX_CACHE_ENTRIES = 1000

function cacheSet(key: string, entry: { url: string; expiresAt: number }): void {
  if (!signedUrlCache.has(key) && signedUrlCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = signedUrlCache.keys().next()
    if (!oldest.done) signedUrlCache.delete(oldest.value)
  }
  signedUrlCache.set(key, entry)
}

/** Clear the signed-URL cache (test support). */
export function resetSignedUrlCache(): void {
  signedUrlCache.clear()
}

const SAFETY_MARGIN_S = 60

function cacheKey(expiresIn: number, path: string): string {
  return `${expiresIn}:${path}`
}

/**
 * Normalize a value to a storage object path.
 * Accepts both full public URLs and raw paths.
 *
 * URL input:  https://<project>.supabase.co/storage/v1/object/public/construction-photos/<path>
 * Path input: {userId}/{projectId}/{filename}
 * Output:     <path> (same as input for raw paths)
 */
export function toStoragePath(value: string): string | null {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value
  }
  try {
    const url = new URL(value)
    const match = url.pathname.match(PUBLIC_URL_PATTERN)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * P1-1 (cross-tenant oracle): decide whether a stored value references an
 * object inside a project's own schema folder (`schemas/{projectId}/...`).
 *
 * Normalizes URLs and raw paths via toStoragePath, then requires the first
 * path segment to be exactly `schemas` and the second to be exactly the
 * project id. Rejects `..` segments so a path like
 * `schemas/{projectId}/../../other-company/x.jpg` cannot escape the folder,
 * and fails closed for any value toStoragePath cannot normalize.
 */
export function isProjectSchemaPath(stored: string, projectId: string): boolean {
  const path = toStoragePath(stored)
  if (!path) return false
  const segments = path.split('/')
  return (
    segments[0] === 'schemas' &&
    segments[1] === projectId &&
    !segments.includes('..')
  )
}

/**
 * Generate a signed URL for a storage object.
 * Accepts both public URLs and raw storage paths.
 *
 * Fail-closed: throws when the value is not a valid storage object path or
 * when the storage API cannot produce a signed URL. Never echoes attacker-
 * controlled input back as a URL (P1-1 SSRF mitigation).
 *
 * Results are cached for the URL's remaining lifetime, so repeated calls for
 * the same path within that window are served without a storage round-trip.
 *
 * @param client - Supabase client (anon key respects storage RLS)
 * @param stored - The value stored in the DB (public URL or raw path)
 * @param expiresIn - Seconds until the signed URL expires (default 1 hour)
 */
export async function getSignedUrl(
  client: SupabaseClient,
  stored: string,
  expiresIn = 3600,
): Promise<string> {
  const path = toStoragePath(stored)
  if (!path || path.split('/').includes('..')) {
    throw new Error(`Invalid storage object path: ${stored.slice(0, 100)}`)
  }

  const key = cacheKey(expiresIn, path)
  const cached = signedUrlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL for ${path}`)
  }

  cacheSet(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + Math.max(0, expiresIn - SAFETY_MARGIN_S) * 1000,
  })

  return data.signedUrl
}

/**
 * Generate signed URLs for multiple objects in one batch round-trip.
 *
 * Unlike a Promise.all of getSignedUrl calls, this uses Supabase's
 * createSignedUrls API so the storage server signs every path in a single
 * request (kills the N+1 pattern on photo-list routes). Cached paths are
 * skipped and only the misses hit the storage API.
 */
export async function getSignedUrls(
  client: SupabaseClient,
  storedValues: string[],
  expiresIn = 3600,
): Promise<string[]> {
  const result: string[] = new Array(storedValues.length)
  const misses: { index: number; path: string }[] = []

  storedValues.forEach((stored, index) => {
    const path = toStoragePath(stored)
    if (!path || path.split('/').includes('..')) {
      throw new Error(`Invalid storage object path: ${stored.slice(0, 100)}`)
    }
    const key = cacheKey(expiresIn, path)
    const cached = signedUrlCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      result[index] = cached.url
    } else {
      misses.push({ index, path })
    }
  })

  if (misses.length === 0) {
    return result
  }

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrls(
      misses.map((m) => m.path),
      expiresIn,
    )

  if (error) {
    throw new Error(`Failed to generate signed URLs for ${misses.length} paths`)
  }

  const expiresAt = Date.now() + Math.max(0, expiresIn - SAFETY_MARGIN_S) * 1000
  misses.forEach((miss, i) => {
    const entry = data?.[i]
    if (!entry?.signedUrl) {
      throw new Error(`Failed to generate signed URL for ${miss.path}`)
    }
    cacheSet(cacheKey(expiresIn, miss.path), {
      url: entry.signedUrl,
      expiresAt,
    })
    result[miss.index] = entry.signedUrl
  })

  return result
}

/**
 * Defense-in-depth guard for P1-1 (SSRF): only allow HTTPS URLs on the
 * project's own Supabase host to be fetched. getSignedUrl is already
 * fail-closed, but this blocks any future code path that could pass an
 * attacker-controlled URL to fetch().
 *
 * @throws when the URL is not HTTPS, or when NEXT_PUBLIC_SUPABASE_URL is set
 *         and the URL's hostname differs from it.
 */
export function assertSafeStorageUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:') {
    throw new Error('Storage URL must use HTTPS')
  }
  const expectedHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : null
  if (expectedHost && url.hostname !== expectedHost) {
    throw new Error('Storage URL host mismatch')
  }
  return value
}

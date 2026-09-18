import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import { getSignedUrls, toStoragePath, assertSafeStorageUrl } from '@/lib/storage/signed-url'
import { monitoring } from '@/lib/monitoring'
import {
  computeManifestHash,
  verifyPhotoHash,
  type PhotoVerdict,
} from '@/lib/evidence/manifest'

export interface VerifyPhotoResult {
  id: string
  verdict: PhotoVerdict
}

const FETCH_TIMEOUT_MS = 10_000
const FETCH_CONCURRENCY = 8

async function sha256OfUrl(signedUrl: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(assertSafeStorageUrl(signedUrl), {
      signal: controller.signal,
    })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return createHash('sha256').update(buffer).digest('hex')
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** At most `limit` fetches in flight — serial fetching exceeds the route timeout on large manifests. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (next < items.length) {
      const current = next++
      results[current] = await fn(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

// GET /api/verify/[manifestId] — public: anyone holding the QR link can verify.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ manifestId: string }> },
) {
  try {
    const rateLimit = checkRateLimit(`verify:${getClientIp(request)}`, {
      limit: 30,
      windowMs: 60 * 1000,
    })
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit)
    }

    const { manifestId } = await params
    const admin = createAdminClient()

    const { data: manifest } = await admin
      .from('report_manifests')
      .select('id, project_id, photo_ids, manifest_hash, created_at')
      .eq('id', manifestId)
      .single()
    if (!manifest) return errorResponse('Manifest not found', 404)

    const photoIds = (manifest.photo_ids ?? []) as string[]
    const { data: photos } = await admin
      .from('photos')
      .select('id, image_url, content_hash')
      .in('id', photoIds.length > 0 ? photoIds : ['00000000-0000-0000-0000-000000000000'])

    const byId = new Map(
      ((photos ?? []) as { id: string; image_url: string; content_hash: string | null }[]).map(
        (p) => [p.id, p],
      ),
    )
    // Sign only rows that exist with a normalizable path. Missing rows keep
    // no URL, so they fall through to per-photo mismatch below instead of
    // failing the whole batch inside getSignedUrls.
    const targets = photoIds.map((id, index) => {
      const imageUrl = byId.get(id)?.image_url
      return { index, id, storagePath: imageUrl ? toStoragePath(imageUrl) : null }
    })
    const signable = targets.filter((t) => t.storagePath)
    const signed = await getSignedUrls(
      admin,
      signable.map((s) => s.storagePath as string),
      300,
    )
    const urlByIndex = new Map(signable.map((s, i) => [s.index, signed[i]]))
    const freshByIndex = await mapWithConcurrency(targets, FETCH_CONCURRENCY, (t) => {
      const url = urlByIndex.get(t.index)
      return url ? sha256OfUrl(url) : Promise.resolve(null)
    })

    const results: VerifyPhotoResult[] = []
    const freshHashes: string[] = []
    for (let i = 0; i < photoIds.length; i++) {
      const row = byId.get(photoIds[i])
      if (!row) {
        results.push({ id: photoIds[i], verdict: 'mismatch' })
        continue
      }
      const fresh = freshByIndex[i]
      const verdict = verifyPhotoHash(fresh, row.content_hash)
      results.push({ id: photoIds[i], verdict })
      if (verdict === 'match' && fresh) freshHashes.push(fresh)
    }

    const recomputed = computeManifestHash(freshHashes)
    const manifestMatch =
      results.every((r) => r.verdict !== 'mismatch') &&
      freshHashes.length === photoIds.filter((id) => byId.get(id)?.content_hash).length &&
      recomputed === manifest.manifest_hash
    const unverifiable = results.filter((r) => r.verdict === 'unverifiable').length

    return successResponse({
      manifest_id: manifest.id,
      project_id: manifest.project_id,
      created_at: manifest.created_at,
      verdict: manifestMatch ? 'valid' : 'invalid',
      manifest_hash: manifest.manifest_hash,
      recomputed_hash: recomputed,
      photos: results,
      unverifiable,
    })
  } catch (err: unknown) {
    monitoring.captureException(err)
    return errorResponse('Verification failed', 500)
  }
}

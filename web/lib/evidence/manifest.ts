import { createHash } from 'node:crypto'

/**
 * Tamper-evident manifest hash: SHA-256 over the lexicographically sorted
 * photo content hashes, joined without separators. Sorting makes the
 * manifest independent of photo selection order; any altered, added, or
 * removed photo changes the digest.
 */
export function computeManifestHash(contentHashes: string[]): string {
  return createHash('sha256')
    .update([...contentHashes].sort().join(''))
    .digest('hex')
}

export interface ManifestPhoto {
  id: string
  content_hash: string | null
}

export interface ManifestSplit {
  verifiable: ManifestPhoto[]
  unverifiable: ManifestPhoto[]
}

/** Legacy photos without a hash verify as unverifiable, never as failed. */
export function splitVerifiable(photos: ManifestPhoto[]): ManifestSplit {
  const verifiable: ManifestPhoto[] = []
  const unverifiable: ManifestPhoto[] = []
  for (const photo of photos) {
    if (photo.content_hash) verifiable.push(photo)
    else unverifiable.push(photo)
  }
  return { verifiable, unverifiable }
}

export type PhotoVerdict = 'match' | 'mismatch' | 'unverifiable'

/** Compare a freshly recomputed hash against the stored one. */
export function verifyPhotoHash(
  freshHash: string | null,
  storedHash: string | null,
): PhotoVerdict {
  if (!storedHash) return 'unverifiable'
  if (!freshHash) return 'mismatch'
  return freshHash === storedHash ? 'match' : 'mismatch'
}

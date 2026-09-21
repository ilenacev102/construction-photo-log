import { describe, it, expect } from 'vitest'
import { computeManifestHash, splitVerifiable, verifyPhotoHash } from '@/lib/evidence/manifest'

describe('computeManifestHash', () => {
  it('is order-independent', () => {
    expect(computeManifestHash(['b', 'a', 'c'])).toBe(
      computeManifestHash(['a', 'b', 'c']),
    )
  })

  it('changes when any photo is altered, added, or removed', () => {
    const base = computeManifestHash(['a', 'b', 'c'])
    expect(computeManifestHash(['a', 'b', 'X'])).not.toBe(base)
    expect(computeManifestHash(['a', 'b', 'c', 'd'])).not.toBe(base)
    expect(computeManifestHash(['a', 'b'])).not.toBe(base)
  })

  it('returns 64-char hex', () => {
    expect(computeManifestHash(['a'])).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('splitVerifiable', () => {
  it('separates hashed from legacy photos', () => {
    const { verifiable, unverifiable } = splitVerifiable([
      { id: '1', content_hash: 'abc' },
      { id: '2', content_hash: null },
    ])
    expect(verifiable.map((p) => p.id)).toEqual(['1'])
    expect(unverifiable.map((p) => p.id)).toEqual(['2'])
  })
})

describe('verifyPhotoHash', () => {
  it('matches identical hashes', () => {
    expect(verifyPhotoHash('abc', 'abc')).toBe('match')
  })

  it('flags altered content as mismatch', () => {
    expect(verifyPhotoHash('xyz', 'abc')).toBe('mismatch')
  })

  it('reports legacy photos as unverifiable, never failed', () => {
    expect(verifyPhotoHash('xyz', null)).toBe('unverifiable')
    expect(verifyPhotoHash(null, null)).toBe('unverifiable')
  })

  it('treats missing fresh bytes as mismatch when a hash is stored', () => {
    expect(verifyPhotoHash(null, 'abc')).toBe('mismatch')
  })
})

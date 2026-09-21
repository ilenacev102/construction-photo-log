import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertSafeStorageUrl,
  toStoragePath,
  getSignedUrl,
  resetSignedUrlCache,
} from '../signed-url'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  resetSignedUrlCache()
})

describe('assertSafeStorageUrl (P1-1 SSRF guard)', () => {
  it('accepts an https URL on the configured Supabase host', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    const url = 'https://abc.supabase.co/storage/v1/object/sign/x/y.png?token=t'
    expect(assertSafeStorageUrl(url)).toBe(url)
  })

  it('throws on non-https protocols', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    expect(() => assertSafeStorageUrl('http://abc.supabase.co/x')).toThrow(
      'Storage URL must use HTTPS',
    )
  })

  it('throws on host mismatch when a Supabase URL is configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    expect(() => assertSafeStorageUrl('https://attacker.example.com/x')).toThrow(
      'Storage URL host mismatch',
    )
  })

  it('accepts any https host when NEXT_PUBLIC_SUPABASE_URL is unset (dev fallback)', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(assertSafeStorageUrl('https://any.example.com/x')).toBe('https://any.example.com/x')
  })

  it('throws on invalid URLs', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    expect(() => assertSafeStorageUrl('not a url')).toThrow()
  })
})

describe('toStoragePath', () => {
  it('passes raw storage paths through unchanged', () => {
    expect(toStoragePath('user-1/proj-1/photo.png')).toBe('user-1/proj-1/photo.png')
  })

  it('extracts the object path from a public storage URL', () => {
    expect(
      toStoragePath(
        'https://abc.supabase.co/storage/v1/object/public/construction-photos/u/p/f.png',
      ),
    ).toBe('u/p/f.png')
  })

  it('returns null for a URL outside the construction-photos bucket', () => {
    expect(toStoragePath('https://abc.supabase.co/storage/v1/object/public/other/p.png')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(toStoragePath('http://[invalid')).toBeNull()
  })
})

describe('getSignedUrl (fail-closed P1-1)', () => {
  function mockClient(overrides: { error?: unknown; signedUrl?: string }) {
    return {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: overrides.signedUrl ? { signedUrl: overrides.signedUrl } : null,
            error: overrides.error ?? null,
          }),
        }),
      },
    } as unknown as SupabaseClient
  }

  it('returns the signed URL from the storage API', async () => {
    const client = mockClient({ signedUrl: 'https://abc.supabase.co/signed/1' })
    await expect(getSignedUrl(client, 'u/p/f.png')).resolves.toBe('https://abc.supabase.co/signed/1')
  })

  it('throws instead of echoing the input when the path is invalid', async () => {
    const client = mockClient({})
    await expect(getSignedUrl(client, 'https://attacker.example.com/steal')).rejects.toThrow(
      'Invalid storage object path',
    )
    // fail-closed: no storage call made for invalid input
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('throws when the storage API errors', async () => {
    const client = mockClient({ error: new Error('storage down') })
    await expect(getSignedUrl(client, 'u/p/f.png')).rejects.toThrow(
      'Failed to generate signed URL',
    )
  })

  it('throws when the storage API returns no signed URL', async () => {
    const client = mockClient({ signedUrl: undefined, error: null })
    await expect(getSignedUrl(client, 'u/p/f.png')).rejects.toThrow(
      'Failed to generate signed URL',
    )
  })
})

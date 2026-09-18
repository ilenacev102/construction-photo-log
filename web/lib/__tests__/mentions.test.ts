import { describe, expect, it } from 'vitest'
import { extractMentions, highlightMentions } from '../mentions'

describe('extractMentions', () => {
  it('returns empty array for empty input', () => {
    expect(extractMentions('')).toEqual([])
    expect(extractMentions(null as unknown as string)).toEqual([])
    expect(extractMentions(undefined as unknown as string)).toEqual([])
  })

  it('returns empty array when no mentions', () => {
    expect(extractMentions('Hello world')).toEqual([])
    expect(extractMentions('Check this photo')).toEqual([])
  })

  it('extracts single mention', () => {
    expect(extractMentions('@John check this')).toEqual(['John'])
  })

  it('extracts multiple mentions', () => {
    expect(extractMentions('@John @Jane check this')).toEqual(['John', 'Jane'])
  })

  it('extracts mentions with spaces in names', () => {
    expect(extractMentions('@John Smith check this')).toEqual(['John Smith'])
  })

  it('extracts mentions with hyphens', () => {
    expect(extractMentions('@Jane-Doe check this')).toEqual(['Jane-Doe'])
  })

  it('deduplicates mentions', () => {
    expect(extractMentions('@John hello @John')).toEqual(['John'])
  })

  it('handles trailing mention', () => {
    expect(extractMentions('Check this @John')).toEqual(['John'])
  })

  it('handles Macedonian characters', () => {
    expect(extractMentions('@Ѓорѓе провери ова')).toEqual(['Ѓорѓе'])
  })
})

describe('highlightMentions', () => {
  it('returns empty string for empty input', () => {
    expect(highlightMentions('')).toBe('')
  })

  it('wraps mentions in span tags', () => {
    expect(highlightMentions('@John check this')).toBe(
      '<span class="mention">@John</span> check this'
    )
  })

  it('handles multiple mentions', () => {
    expect(highlightMentions('@John @Jane')).toBe(
      '<span class="mention">@John</span> <span class="mention">@Jane</span>'
    )
  })

  it('leaves non-mention text unchanged', () => {
    expect(highlightMentions('Hello world')).toBe('Hello world')
  })
})

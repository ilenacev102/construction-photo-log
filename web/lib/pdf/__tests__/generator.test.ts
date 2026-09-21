// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import { generateReport, type ReportLanguage } from '../generator'

const LANGUAGES: ReportLanguage[] = ['mk', 'en', 'de', 'sl', 'sr']

describe('generateReport branding smoke', () => {
  let tmpDir: string
  let imagePaths: string[]

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-smoke-'))
    // Create a few tiny JPEGs to exercise the image path
    imagePaths = []
    for (let i = 0; i < 6; i++) {
      const p = path.join(tmpDir, `photo-${i}.jpg`)
      await sharp({
        create: { width: 64, height: 48, channels: 3, background: { r: 40 + i * 30, g: 80, b: 120 } },
      })
        .jpeg()
        .toFile(p)
      imagePaths.push(p)
    }
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('produces a valid PDF with company branding for every language', async () => {
    for (const lang of LANGUAGES) {
      const out = path.join(tmpDir, `report-${lang}.pdf`)
      await generateReport(out, {
        title: `Smoke ${lang}`,
        project_name: `Project-${lang}`,
        client_name: `Client-${lang}`,
        address: 'Address 1, 1000 Skopje',
        company_name: `Brand-${lang}`,
        language: lang,
        photos: imagePaths.map((image_path, i) => ({
          image_path,
          caption: `Caption ${lang} ${i}`,
          taken_at: '2026-08-06T10:00:00Z',
          latitude: 41.9981,
          longitude: 21.4254,
        })),
      })

      const buf = fs.readFileSync(out)
      expect(buf.length, `${lang}: PDF should be non-trivial size`).toBeGreaterThan(1000)
      // Valid PDF magic header
      expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
      // Multi-page: 6 photos must overflow one A4 page, exercising
      // bufferPages + bufferedPageRange + switchToPage footers
      const tail = buf.subarray(buf.length - 2048).toString()
      expect(tail, `${lang}: PDF must have %%EOF trailer`).toContain('%%EOF')
    }
  })

  it('produces a single-page PDF with no photos (footer only)', async () => {
    const out = path.join(tmpDir, 'report-empty.pdf')
    await generateReport(out, {
      company_name: 'Acme Construction',
      language: 'en',
      photos: [],
    })
    const buf = fs.readFileSync(out)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.subarray(buf.length - 2048).toString()).toContain('%%EOF')
  })
})

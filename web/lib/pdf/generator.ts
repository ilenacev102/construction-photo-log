import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// ── Types ────────────────────────────────────────────────────────

export interface PhotoEntry {
  image_path: string
  caption?: string
  taken_at?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type ReportLanguage = keyof typeof LABELS

export interface ReportVerify {
  url: string
  manifestHash: string
  verifiableCount: number
  unverifiableCount: number
  qrImagePath?: string
}

export interface ReportOptions {
  title?: string
  project_name?: string
  client_name?: string
  address?: string
  company_name?: string
  language?: ReportLanguage
  photos?: PhotoEntry[]
  verify?: ReportVerify
}

// ── Multilingual Labels ──────────────────────────────────────────

const LABELS = {
  mk: {
    report_title: 'Градежен фото извештај',
    project: 'Проект:',
    client: 'Клиент:',
    address: 'Адреса:',
    generated: 'Генерирано:',
    photo_label: 'Фотографија',
    captured: 'Сликано:',
    gps: 'GPS:',
    page: 'Страница',
    image_error: '[Сликата не може да се вчита]',
    verification: 'Верификација на автентичност',
    verification_desc:
      'Скенирајте го QR-кодот или отворете ја адресата за независна проверка на овој извештај.',
    manifest: 'Manifest hash:',
    verifiable: 'Проверливи фотографии:',
    unverifiable: 'Непроверливи (legacy) фотографии:',
  },
  en: {
    report_title: 'Construction Photo Report',
    project: 'Project:',
    client: 'Client:',
    address: 'Address:',
    generated: 'Generated:',
    photo_label: 'Photo',
    captured: 'Captured:',
    gps: 'GPS:',
    page: 'Page',
    image_error: '[Image could not be loaded]',
    verification: 'Authenticity verification',
    verification_desc:
      'Scan the QR code or open the address for independent verification of this report.',
    manifest: 'Manifest hash:',
    verifiable: 'Verifiable photos:',
    unverifiable: 'Unverifiable (legacy) photos:',
  },
  de: {
    report_title: 'Bau-Fotobericht',
    project: 'Projekt:',
    client: 'Kunde:',
    address: 'Adresse:',
    generated: 'Erstellt:',
    photo_label: 'Foto',
    captured: 'Aufgenommen:',
    gps: 'GPS:',
    page: 'Seite',
    image_error: '[Bild konnte nicht geladen werden]',
    verification: 'Echtheitsprüfung',
    verification_desc:
      'Scannen Sie den QR-Code oder öffnen Sie die Adresse zur unabhängigen Prüfung dieses Berichts.',
    manifest: 'Manifest-Hash:',
    verifiable: 'Prüfbare Fotos:',
    unverifiable: 'Nicht prüfbare (Legacy-) Fotos:',
  },
  sl: {
    report_title: 'Gradbeno foto poročilo',
    project: 'Projekt:',
    client: 'Stranka:',
    address: 'Naslov:',
    generated: 'Ustvarjeno:',
    photo_label: 'Fotografija',
    captured: 'Posneto:',
    gps: 'GPS:',
    page: 'Stran',
    image_error: '[Slike ni mogoče naložiti]',
    verification: 'Preverjanje verodostojnosti',
    verification_desc:
      'Skenirajte QR-kodo ali odprite naslov za neodvisno preverjanje tega poročila.',
    manifest: 'Manifest hash:',
    verifiable: 'Preverljive fotografije:',
    unverifiable: 'Nepreverljive (legacy) fotografije:',
  },
  sr: {
    report_title: 'Građevinski foto izveštaj',
    project: 'Projekt:',
    client: 'Klijent:',
    address: 'Adresa:',
    generated: 'Generisano:',
    photo_label: 'Fotografija',
    captured: 'Snimljeno:',
    gps: 'GPS:',
    page: 'Stranica',
    image_error: '[Slike nije moguće učitati]',
    verification: 'Provera autentičnosti',
    verification_desc:
      'Skenirajte QR kod ili otvorite adresu za nezavisnu proveru ovog izveštaja.',
    manifest: 'Manifest hash:',
    verifiable: 'Proverljive fotografije:',
    unverifiable: 'Neproverljive (legacy) fotografije:',
  },
}

// ── Layout Constants (points) ────────────────────────────────────

const MM = 2.834_645_669_291_339 // points per mm
const PAGE_WIDTH = 595.28 // A4 width (points)
const PAGE_HEIGHT = 841.89 // A4 height (points)
const MARGIN = 20 * MM // ~56.69pt
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
const IMG_MAX_HEIGHT = 100 * MM // ~283.46pt
const IMG_MAX_WIDTH = CONTENT_WIDTH
const PAGE_BREAK_THRESHOLD = 40 * MM // ~113.39pt (remaining space near bottom)

// ── Fonts ────────────────────────────────────────────────────────
// On Vercel, process.cwd() is the project root.
// Fonts are placed in public/fonts/ so they're bundled with the deployment.
const FONT_REGULAR = path.join(process.cwd(), 'public/fonts', 'DejaVuSans.ttf')
const FONT_BOLD = path.join(process.cwd(), 'public/fonts', 'DejaVuSans-Bold.ttf')

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function remainingSpace(doc: InstanceType<typeof PDFDocument>) {
  return PAGE_HEIGHT - MARGIN - doc.y
}

function needsPageBreak(doc: InstanceType<typeof PDFDocument>) {
  return remainingSpace(doc) < PAGE_BREAK_THRESHOLD
}

function checkPageBreak(doc: InstanceType<typeof PDFDocument>) {
  if (needsPageBreak(doc)) {
    doc.addPage()
  }
}

/**
 * Draw a footer (company name + page number) on every page. Must run while
 * pages are still buffered (bufferPages: true), before doc.end().
 */
function drawFooters(
  doc: InstanceType<typeof PDFDocument>,
  companyName: string | undefined,
  labels: (typeof LABELS)['mk'],
) {
  const range = doc.bufferedPageRange()
  const total = range.count
  const footerY = PAGE_HEIGHT - 10 * MM

  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i)

    // Thin separator line above the footer
    doc
      .moveTo(MARGIN, footerY - 4)
      .lineTo(PAGE_WIDTH - MARGIN, footerY - 4)
      .lineWidth(0.5)
      .strokeColor('#999999')
      .stroke()

    doc.font('Sans').fontSize(8).fillColor('#666666')

    if (companyName) {
      doc.text(companyName, MARGIN, footerY, { align: 'left', width: CONTENT_WIDTH / 2 })
    }

    doc.text(
      `${labels.page} ${i - range.start + 1} / ${total}`,
      MARGIN + CONTENT_WIDTH / 2,
      footerY,
      { align: 'right', width: CONTENT_WIDTH / 2 },
    )

    doc.fillColor('#000000')
  }
}

// ── Generator ────────────────────────────────────────────────────

export async function generateReport(
  outputPath: string,
  options: ReportOptions,
): Promise<string> {
  const lang = options.language ?? 'mk'
  const labels = LABELS[lang] ?? LABELS.mk
  const title = options.title ?? labels.report_title

  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: title,
      Creator: 'Construction Photo Log',
    },
  })

  const stream = fs.createWriteStream(outputPath)
  doc.pipe(stream)

  // Register fonts
  doc.registerFont('Sans', FONT_REGULAR)
  doc.registerFont('Sans-Bold', FONT_BOLD)

  // ── Header ──────────────────────────────────────────────────
  if (options.company_name) {
    doc.font('Sans-Bold').fontSize(9).fillColor('#444444')
    doc.text(options.company_name, MARGIN, doc.y, { align: 'right' })
    doc.fillColor('#000000')
    doc.moveDown(8 / 4)
  }

  doc.font('Sans-Bold').fontSize(20).text(title, MARGIN, doc.y, { align: 'left' })
  doc.moveDown(12 / 4) // ~12mm spacing (moveDown uses line height)

  if (options.project_name) {
    doc.font('Sans').fontSize(11).text(`${labels.project} ${options.project_name}`)
    doc.moveDown(6 / 4)
  }
  if (options.client_name) {
    doc.font('Sans').fontSize(11).text(`${labels.client} ${options.client_name}`)
    doc.moveDown(6 / 4)
  }
  if (options.address) {
    doc.font('Sans').fontSize(11).text(`${labels.address} ${options.address}`)
    doc.moveDown(4 / 4)
  }

  doc.font('Sans').fontSize(9).text(`${labels.generated} ${formatDate(new Date())}`)
  doc.moveDown(10 / 4)

  // ── Photos ──────────────────────────────────────────────────
  const photos = options.photos ?? []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]

    // Page break if not enough room (photo header + image + metadata)
    checkPageBreak(doc)

    // Photo number
    doc.font('Sans-Bold').fontSize(12).text(`${labels.photo_label} ${i + 1}`, MARGIN, doc.y, { align: 'left' })
    doc.moveDown(8 / 4)

    // Image
    try {
      const metadata = await sharp(photo.image_path).metadata()
      const imgWidth = metadata.width ?? 0
      const imgHeight = metadata.height ?? 0

      if (imgWidth > 0 && imgHeight > 0) {
        const ratio = Math.min(1, IMG_MAX_WIDTH / imgWidth, IMG_MAX_HEIGHT / imgHeight)
        const drawWidth = Math.floor(imgWidth * ratio)
        const drawHeight = Math.floor(imgHeight * ratio)

        doc.image(photo.image_path, MARGIN, doc.y, { width: drawWidth, height: drawHeight })
        doc.y += drawHeight
      }
    } catch {
      // Image could not be loaded – show error text instead
      doc.font('Sans').fontSize(10).text(labels.image_error, MARGIN, doc.y, { align: 'left' })
      doc.y += 14 // small height for error placeholder
    }

    doc.moveDown(4 / 4)

    // Caption
    if (photo.caption) {
      doc.font('Sans').fontSize(10).text(photo.caption, MARGIN, doc.y, { align: 'left' })
      doc.moveDown(5 / 4)
    }

    // Taken at
    if (photo.taken_at) {
      const takenDate = new Date(photo.taken_at)
      if (!isNaN(takenDate.getTime())) {
        doc.font('Sans').fontSize(8).text(`${labels.captured} ${formatDate(takenDate)}`)
        doc.moveDown(4 / 4)
      }
    }

    // GPS
    if (photo.latitude != null && photo.longitude != null) {
      doc.font('Sans').fontSize(8).text(`${labels.gps} ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`)
      doc.moveDown(4 / 4)
    }

    doc.moveDown(8 / 4)
  }

  // ── Verification ────────────────────────────────────────────
  if (options.verify) {
    const verify = options.verify
    doc.addPage()
    doc.font('Sans-Bold').fontSize(14).text(labels.verification, MARGIN, doc.y, { align: 'left' })
    doc.moveDown(8 / 4)
    doc.font('Sans').fontSize(9).text(labels.verification_desc, MARGIN, doc.y, { align: 'left' })
    doc.moveDown(8 / 4)

    if (verify.qrImagePath) {
      try {
        doc.image(verify.qrImagePath, MARGIN, doc.y, { width: 45 * MM, height: 45 * MM })
        doc.y += 45 * MM
        doc.moveDown(6 / 4)
      } catch {
        // QR image unreadable — the URL below remains the fallback.
      }
    }

    doc.font('Sans').fontSize(9).fillColor('#0000EE').text(verify.url, MARGIN, doc.y, {
      align: 'left',
    })
    doc.fillColor('#000000')
    doc.moveDown(6 / 4)
    doc.font('Sans').fontSize(8).text(`${labels.manifest} ${verify.manifestHash}`)
    doc.moveDown(4 / 4)
    doc.font('Sans').fontSize(8).text(`${labels.verifiable} ${verify.verifiableCount}`)
    doc.moveDown(4 / 4)
    doc.font('Sans').fontSize(8).text(`${labels.unverifiable} ${verify.unverifiableCount}`)
    doc.moveDown(4 / 4)
  }

  // ── Finalize ────────────────────────────────────────────────
  drawFooters(doc, options.company_name, labels)
  doc.end()

  return new Promise<string>((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath))
    stream.on('error', reject)
  })
}

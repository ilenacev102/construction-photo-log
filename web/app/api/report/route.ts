import { NextRequest } from 'next/server'
import { requireProjectAccess } from '@/lib/api/company-auth'
import { getSignedUrl, getSignedUrls, toStoragePath, assertSafeStorageUrl } from '@/lib/storage/signed-url'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { generateReportSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/api/rate-limit'
import path from 'path'
import fs from 'fs'
import os from 'os'
import QRCode from 'qrcode'
import { generateReport } from '@/lib/pdf/generator'
import type { PhotoEntry } from '@/lib/pdf/generator'
import { computeManifestHash, splitVerifiable } from '@/lib/evidence/manifest'

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null
  try {
    const { user } = await requireAuth()

    // Rate limiting: 5 PDF reports per 60 seconds per user / IP
    const rateLimitKey = `report:${user.id || getClientIp(request)}`
    const rateLimit = checkRateLimit(rateLimitKey, { limit: 5, windowMs: 60 * 1000 })
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit, 'Премногу барања за PDF извештај. Обидете се повторно наскоро.')
    }

    const { data: body, error: validationError } = await validateBody(request, generateReportSchema)
    if (validationError) return validationError
    const { projectId, photoIds, title, language } = body!
    if (photoIds.length > 100) {
      return errorResponse('Too many photos (max 100)')
    }

    const admin = createAdminClient()
    await requireProjectAccess(admin, user.id, projectId)

    // Fetch project metadata for the branded report header
    const { data: project } = await admin
      .from('projects')
      .select('name, client_name, address, user_id')
      .eq('id', projectId)
      .single()

    // Resolve the owning company name for header/footer branding
    let companyName: string | undefined
    if (project?.user_id) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('company_name')
        .eq('id', project.user_id)
        .single()
      companyName = ownerProfile?.company_name || undefined
    }

    // Fetch photo records — scoped to the project the user can access
    const { data: photos } = await admin
      .from('photos')
      .select('id, project_id, image_url, content_hash, taken_at, latitude, longitude, note')
      .eq('project_id', projectId)
      .in('id', photoIds)

    if (!photos || photos.length === 0) return errorResponse('Photos not found', 404)

    // Evidence: split verifiable from legacy photos, hash the manifest,
    // persist it, and embed a QR verification page into the PDF.
    const { verifiable, unverifiable } = splitVerifiable(
      photos.map((p) => ({ id: p.id as string, content_hash: (p.content_hash as string | null) ?? null })),
    )
    const manifestHash = computeManifestHash(
      verifiable.map((p) => p.content_hash as string),
    )
    const { data: manifest, error: manifestError } = await admin
      .from('report_manifests')
      .insert({
        project_id: projectId,
        created_by: user.id,
        photo_ids: photos.map((p) => p.id),
        manifest_hash: manifestHash,
      })
      .select('id')
      .single()
    if (manifestError || !manifest) {
      return errorResponse('Failed to record report manifest', 500)
    }
    const origin = new URL(request.url).origin
    const verifyUrl = `${origin}/verify/${(manifest as { id: string }).id}`

    // Download images to temp dir (use signed URLs since bucket is private)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-'))
    const entries: PhotoEntry[] = []

    const signedUrls = await getSignedUrls(
      admin,
      photos.map((p) => p.image_url),
      300,
    )

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      const storagePath = toStoragePath(photo.image_url)
      const ext = storagePath ? path.extname(storagePath) : '.jpg'
      const localPath = path.join(/*turbopackIgnore: true*/ tmpDir, `${photo.id}${ext}`)
      const response = await fetch(assertSafeStorageUrl(signedUrls[i]))
      const buffer = Buffer.from(await response.arrayBuffer())
      fs.writeFileSync(localPath, buffer)
      entries.push({
        image_path: localPath,
        caption: photo.note || '',
        taken_at: photo.taken_at,
        latitude: photo.latitude,
        longitude: photo.longitude,
      })
    }

    // Generate PDF using Node.js (Vercel-compatible)
    const outputPath = path.join(tmpDir, 'report.pdf')
    const qrImagePath = path.join(tmpDir, 'verify-qr.png')
    try {
      const qrPng: Buffer = await QRCode.toBuffer(verifyUrl, {
        width: 512,
        margin: 1,
      })
      fs.writeFileSync(qrImagePath, qrPng)
      await generateReport(outputPath, {
        title: title || undefined,
        project_name: project?.name || undefined,
        client_name: project?.client_name || undefined,
        address: project?.address || undefined,
        company_name: companyName,
        language,
        photos: entries,
        verify: {
          url: verifyUrl,
          manifestHash,
          verifiableCount: verifiable.length,
          unverifiableCount: unverifiable.length,
          qrImagePath,
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return errorResponse(`PDF generation failed: ${msg}`, 500)
    }

    // Admin client: authz already enforced via requireProjectAccess; session
    // client's storage RLS would block admin reports on other companies.
    const pdfBuffer = fs.readFileSync(outputPath)
    const pdfFileName = `${user.id}/${projectId}/report-${Date.now()}.pdf`
    const { error: uploadError } = await admin.storage
      .from('construction-photos')
      .upload(pdfFileName, pdfBuffer, { contentType: 'application/pdf' })

    if (uploadError) throw uploadError

    const pdfUrl = await getSignedUrl(admin, `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/construction-photos/${pdfFileName}`, 86400)

    return successResponse({
      pdf_url: pdfUrl,
      manifest_id: (manifest as { id: string }).id,
      verify_url: verifyUrl,
      verifiable: verifiable.length,
      unverifiable: unverifiable.length,
    })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

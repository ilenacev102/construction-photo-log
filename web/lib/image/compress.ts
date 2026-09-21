import sharp from 'sharp'

export interface CompressOptions {
  /** Max width in pixels (default: 2048) */
  maxWidth?: number
  /** Max height in pixels (default: 2048) */
  maxHeight?: number
  /** JPEG quality 1–100 (default: 80) */
  quality?: number
}

const DEFAULTS = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 80,
} satisfies Required<CompressOptions>

export const THUMBNAIL_MAX_DIMENSION = 400
export const THUMBNAIL_QUALITY = 75

/**
 * Compress image: resize to 2048px max, output progressive JPEG at quality 80,
 * preserve EXIF metadata (GPS, date taken, camera info), never upscale.
 */
export async function compressImage(
  buffer: Buffer,
  options: CompressOptions = {},
): Promise<Buffer> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULTS, ...options }

  return sharp(buffer)
    .rotate()
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, progressive: true, mozjpeg: true })
    .withMetadata()
    .toBuffer()
}

/**
 * Generate lightweight responsive thumbnail (<=400px, quality 75) for list views,
 * calendar grids, and heatmaps.
 */
export async function compressThumbnail(
  buffer: Buffer,
  options: CompressOptions = {},
): Promise<Buffer> {
  return compressImage(buffer, {
    maxWidth: THUMBNAIL_MAX_DIMENSION,
    maxHeight: THUMBNAIL_MAX_DIMENSION,
    quality: THUMBNAIL_QUALITY,
    ...options,
  })
}

export interface ResponsiveVariants {
  full: Buffer
  thumbnail: Buffer
}

export async function createResponsiveVariants(
  buffer: Buffer,
): Promise<ResponsiveVariants> {
  const [full, thumbnail] = await Promise.all([
    compressImage(buffer),
    compressThumbnail(buffer),
  ])
  return { full, thumbnail }
}

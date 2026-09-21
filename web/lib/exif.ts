import exifr from 'exifr'
import { monitoring } from './monitoring'

export interface ExifData {
  takenAt: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * Extract EXIF data from a photo file.
 * Returns GPS coordinates and capture timestamp if available.
 */
export async function extractExif(file: File): Promise<ExifData> {
  try {
    // Parse only what we need for performance
    const data = await exifr.parse(file, {
      exif: true,
      gps: true,
      xmp: false,
      icc: false,
      iptc: false,
      tiff: false,
      interop: false,
    })

    if (!data) {
      // No EXIF data found — fall back to file timestamp
      return {
        takenAt: new Date(file.lastModified).toISOString(),
        latitude: null,
        longitude: null,
      }
    }

    // DateTimeOriginal is the capture timestamp from the camera
    let takenAt: string | null = null
    if (data.DateTimeOriginal) {
      takenAt =
        data.DateTimeOriginal instanceof Date
          ? data.DateTimeOriginal.toISOString()
          : new Date(data.DateTimeOriginal).toISOString()
    } else {
      takenAt = new Date(file.lastModified).toISOString()
    }

    return {
      takenAt,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    }
  } catch (err) {
    monitoring.captureException(err, { extra: { op: 'exif-extract' } })
    return {
      takenAt: new Date(file.lastModified).toISOString(),
      latitude: null,
      longitude: null,
    }
  }
}
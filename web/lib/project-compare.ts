import type { Defect, Photo } from '@/types/database'
import {
  healthScoreFor as healthScoreFromCounts,
  healthTierFor,
  type HealthTier,
} from '@/lib/health-tiers'
import { DEFAULT_TZ, dayKeyInTz, todayStartInTz, addDays } from '@/lib/time'

export { healthTierFor }
export type { HealthTier }

export interface ProjectCompareStats {
  projectId: string
  photoCount: number
  activeDays: number
  openDefects: number
  inProgressDefects: number
  resolvedDefects: number
  healthScore: number
  healthTier: HealthTier
  photosLast30Days: number
  firstPhotoDate: string | null
  lastPhotoDate: string | null
}

export function healthScoreFor(defects: Defect[]): number {
  const open = defects.filter((d) => d.status === 'open').length
  const inProgress = defects.filter((d) => d.status === 'in_progress').length
  return healthScoreFromCounts(open, inProgress)
}

export function computeProjectStats(
  projectId: string,
  photos: Photo[],
  defects: Defect[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): ProjectCompareStats {
  const projectPhotos = photos.filter((p) => p.project_id === projectId)

  const datedPhotos = projectPhotos.filter((p) => p.taken_at !== null) as Array<
    Photo & { taken_at: string }
  >

  const dayKeys = datedPhotos.map((p) => dayKeyInTz(p.taken_at, tz))
  const activeDays = new Set(dayKeys).size

  // Last 30 calendar days in the project tz, ending today (inclusive).
  const cutoff = addDays(tz, todayStartInTz(tz, now), -29)
  const cutoffKey = dayKeyInTz(cutoff.toISOString(), tz)
  const photosLast30Days = dayKeys.filter((k) => k.localeCompare(cutoffKey) >= 0)
    .length

  const sortedDates = dayKeys.sort((a, b) => a.localeCompare(b))

  const projectDefects = defects.filter((d) => d.project_id === projectId)
  const openDefects = projectDefects.filter((d) => d.status === 'open').length
  const inProgressDefects = projectDefects.filter(
    (d) => d.status === 'in_progress',
  ).length
  const resolvedDefects = projectDefects.filter(
    (d) => d.status === 'resolved' || d.status === 'closed',
  ).length

  const score = healthScoreFor(projectDefects)

  return {
    projectId,
    photoCount: projectPhotos.length,
    activeDays,
    openDefects,
    inProgressDefects,
    resolvedDefects,
    healthScore: score,
    healthTier: healthTierFor(score),
    photosLast30Days,
    firstPhotoDate: sortedDates[0] ?? null,
    lastPhotoDate: sortedDates[sortedDates.length - 1] ?? null,
  }
}
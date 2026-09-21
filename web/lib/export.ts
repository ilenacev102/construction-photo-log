export const EXPORT_TYPES = ['defects', 'photos', 'logs', 'work_orders', 'attendance'] as const

export type ExportType = (typeof EXPORT_TYPES)[number]

/**
 * Trigger a CSV download from the export API route.
 * The server sets Content-Disposition, so the download attribute is only a
 * fallback for environments that ignore response headers.
 */
export function downloadProjectCsv(projectId: string, type: ExportType): void {
  const url = `/api/export?projectId=${encodeURIComponent(projectId)}&type=${type}`
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}-export.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

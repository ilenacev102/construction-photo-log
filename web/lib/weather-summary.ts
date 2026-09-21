import type { DailyLog } from '@/types/database'

export interface ClimateDay {
  date: string
  weather: string | null
  temperature: number | null
}

export interface ClimateSummary {
  days: ClimateDay[]
  avgTemp: number | null
  minTemp: number | null
  maxTemp: number | null
  weatherCounts: Record<string, number>
}

// Extracts the numeric part from values like "23°C", "23 C", "23", "-2°C".
export function parseTemperature(raw: string | null): number | null {
  if (!raw) return null
  const match = raw.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const val = Number(match[0])
  return Number.isFinite(val) ? val : null
}

function weatherKey(weather: string | null): string {
  return (weather ?? '').trim().toLowerCase()
}

export function climateSummary(logs: DailyLog[]): ClimateSummary {
  const days: ClimateDay[] = [...logs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((log) => ({
      date: log.log_date,
      weather: weatherKey(log.weather) || null,
      temperature: parseTemperature(log.temperature),
    }))

  const temps = days
    .map((d) => d.temperature)
    .filter((t): t is number => t !== null)

  const weatherCounts: Record<string, number> = {}
  for (const day of days) {
    if (!day.weather) continue
    weatherCounts[day.weather] = (weatherCounts[day.weather] ?? 0) + 1
  }

  const avgTemp =
    temps.length > 0
      ? Math.round((temps.reduce((sum, t) => sum + t, 0) / temps.length) * 10) / 10
      : null
  const minTemp = temps.length > 0 ? Math.min(...temps) : null
  const maxTemp = temps.length > 0 ? Math.max(...temps) : null

  return { days, avgTemp, minTemp, maxTemp, weatherCounts }
}

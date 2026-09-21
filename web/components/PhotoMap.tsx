'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface PhotoMapProps {
  photos: Array<{
    id: string
    latitude: number | null
    longitude: number | null
    taken_at: string | null
  }>
}

// Fix default marker icon issue with webpack/vite
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export default function PhotoMap({ photos }: PhotoMapProps) {
  const t = useTranslations('photoMap')
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const gpsPhotos = useMemo(
    () => photos.filter((p) => p.latitude !== null && p.longitude !== null),
    [photos]
  )

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize map
    const map = L.map(mapRef.current)
    mapInstanceRef.current = map

    // OpenStreetMap tiles (no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Add markers for photos with GPS
    const bounds = L.latLngBounds([])
    gpsPhotos.forEach((photo) => {
      if (photo.latitude === null || photo.longitude === null) return

      const marker = L.marker([photo.latitude, photo.longitude], {
        icon: defaultIcon,
      }).addTo(map)

      const dateStr = photo.taken_at
        ? new Date(photo.taken_at).toLocaleDateString()
        : ''

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <p style="margin:0 0 4px;font-weight:600;font-size:13px;">
            ${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}
          </p>
          ${dateStr ? `<p class="m-0 text-xs text-muted-foreground">${dateStr}</p>` : ''}
        </div>
      `)

      bounds.extend([photo.latitude, photo.longitude])
    })

    // Fit map to show all markers, or use a default center
    if (gpsPhotos.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] })
    } else {
      map.setView([41.6086, 21.7453], 7) // Center on North Macedonia
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [photos, gpsPhotos])

  // No photos with GPS → show message
  if (gpsPhotos.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
        {t('noGPS')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div ref={mapRef} className="h-[400px] w-full" />
      <div className="border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        {t('count', { shown: gpsPhotos.length, total: photos.length })}
      </div>
    </div>
  )
}

import L from 'leaflet'
import { drawLocationMarker, removeLocationMarker, type LocationMarker } from './locationMarker'

/**
 * Geolocation helper: shows user location on the map.
 * Returns cleanup function to remove markers.
 */
export function locateMe(map: L.Map): () => void {
  let loc: LocationMarker | null = null

  function cleanup(): void {
    removeLocationMarker(loc)
    loc = null
  }

  if (!navigator.geolocation) return cleanup

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords

      cleanup()
      loc = drawLocationMarker(map, latitude, longitude, accuracy)

      map.setView([latitude, longitude], Math.max(map.getZoom(), 15))
    },
    (err) => {
      console.warn('Geolocation error:', err.message)
    },
    { enableHighAccuracy: true, timeout: 10_000 }
  )

  return cleanup
}

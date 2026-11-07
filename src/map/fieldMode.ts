import L from 'leaflet'
import { drawLocationMarker, removeLocationMarker, type LocationMarker } from './locationMarker'

export interface FieldModeCallbacks {
  /** Called on every position update. */
  onPosition?: (lat: number, lng: number, accuracy: number) => void
  /** Called when tracking is stopped (error or manual). */
  onStopped?: (reason: string) => void
}

/**
 * Continuous location tracking for "field mode".
 * Uses watchPosition so the marker follows the user.
 * Returns a cleanup function that stops watching and removes layers.
 */
export function startFieldMode(map: L.Map, cb: FieldModeCallbacks = {}): () => void {
  let loc: LocationMarker | null = null
  let watchId: number | null = null

  function cleanup(): void {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    removeLocationMarker(loc)
    loc = null
  }

  if (!navigator.geolocation) {
    cb.onStopped?.('Geolocation is not available')
    return cleanup
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords

      if (!loc) {
        loc = drawLocationMarker(map, latitude, longitude, accuracy)
      } else {
        loc.accuracy.setLatLng([latitude, longitude])
        loc.accuracy.setRadius(accuracy)
        loc.marker.setLatLng([latitude, longitude])
      }

      cb.onPosition?.(latitude, longitude, accuracy)
    },
    (err) => {
      // Permission denied / unavailable: stop and notify.
      if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
        cb.onStopped?.(err.message)
        cleanup()
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  )

  return cleanup
}

import L from 'leaflet'

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
  let myLocationMarker: L.CircleMarker | null = null
  let accuracyCircle: L.Circle | null = null
  let watchId: number | null = null

  function cleanup(): void {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    if (myLocationMarker) map.removeLayer(myLocationMarker)
    if (accuracyCircle) map.removeLayer(accuracyCircle)
    myLocationMarker = null
    accuracyCircle = null
  }

  if (!navigator.geolocation) {
    cb.onStopped?.('Geolocation nu e disponibilă')
    return cleanup
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      const latlng: L.LatLngExpression = [latitude, longitude]

      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: accuracy,
          color: '#4a90d9',
          fillColor: '#4a90d9',
          fillOpacity: 0.1,
          weight: 1
        }).addTo(map)
      } else {
        accuracyCircle.setLatLng(latlng)
        accuracyCircle.setRadius(accuracy)
      }

      if (!myLocationMarker) {
        myLocationMarker = L.circleMarker(latlng, {
          radius: 6,
          color: '#2196f3',
          fillColor: '#2196f3',
          fillOpacity: 0.8,
          weight: 2
        }).addTo(map)
      } else {
        myLocationMarker.setLatLng(latlng)
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

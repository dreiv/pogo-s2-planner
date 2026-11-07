import L from 'leaflet'

/**
 * Geolocation helper: shows user location on the map.
 * Returns cleanup function to remove markers.
 */
export function locateMe(map: L.Map): () => void {
  let myLocationMarker: L.CircleMarker | null = null
  let accuracyCircle: L.Circle | null = null

  function cleanup(): void {
    if (myLocationMarker) map.removeLayer(myLocationMarker)
    if (accuracyCircle) map.removeLayer(accuracyCircle)
    myLocationMarker = null
    accuracyCircle = null
  }

  if (!navigator.geolocation) return cleanup

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      const latlng: L.LatLngExpression = [latitude, longitude]

      cleanup()

      accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        color: '#4a90d9',
        fillColor: '#4a90d9',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map)

      myLocationMarker = L.circleMarker(latlng, {
        radius: 6,
        color: '#2196f3',
        fillColor: '#2196f3',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map)

      map.setView(latlng, Math.max(map.getZoom(), 15))
    },
    (err) => {
      console.warn('Geolocation error:', err.message)
    },
    { enableHighAccuracy: true, timeout: 10_000 }
  )

  return cleanup
}

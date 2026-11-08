import L from 'leaflet'
import { LOCATION_COLORS } from '../theme'

export interface LocationMarker {
  marker: L.CircleMarker
  accuracy: L.Circle
}

export function drawLocationMarker(
  map: L.Map,
  lat: number,
  lng: number,
  accuracy: number
): LocationMarker {
  const latlng: L.LatLngExpression = [lat, lng]

  const accuracyCircle = L.circle(latlng, {
    radius: accuracy,
    color: LOCATION_COLORS.accuracy,
    fillColor: LOCATION_COLORS.accuracy,
    fillOpacity: 0.1,
    weight: 1
  }).addTo(map)

  const marker = L.circleMarker(latlng, {
    radius: 6,
    color: LOCATION_COLORS.marker,
    fillColor: LOCATION_COLORS.marker,
    fillOpacity: 0.8,
    weight: 2
  }).addTo(map)

  return { marker, accuracy: accuracyCircle }
}

export function removeLocationMarker(loc: LocationMarker | null): void {
  if (!loc) return
  loc.marker.remove()
  loc.accuracy.remove()
}

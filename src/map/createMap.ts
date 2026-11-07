import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapOptions {
  center: [number, number]
  zoom: number
}

/**
 * Create a Leaflet map instance with OSM tiles.
 * Uses canvas renderer for performance with many polygons.
 */
export function createMap(container: HTMLElement, options: MapOptions): L.Map {
  const map = L.map(container, {
    center: options.center,
    zoom: options.zoom,
    preferCanvas: true,
    maxZoom: 19
  })

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map)

  return map
}

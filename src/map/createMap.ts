import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapOptions {
  center: [number, number]
  zoom: number
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function createMap(container: HTMLElement, options: MapOptions): L.Map {
  const map = L.map(container, {
    center: options.center,
    zoom: options.zoom,
    preferCanvas: true,
    maxZoom: 19
  })

  L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR }).addTo(map)

  return map
}

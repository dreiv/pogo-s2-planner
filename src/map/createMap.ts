import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapOptions {
  center: [number, number]
  zoom: number
  /** Use satellite imagery instead of the standard OSM map. */
  satellite?: boolean
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ESRI_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics'

// Tracks the current base tile layer per map so it can be swapped at runtime.
const baseLayers = new WeakMap<L.Map, L.TileLayer>()

function makeTileLayer(satellite: boolean): L.TileLayer {
  if (satellite) {
    return L.tileLayer(ESRI_URL, { maxZoom: 19, attribution: ESRI_ATTR })
  }
  return L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR })
}

/**
 * Swap the map's base tile layer between OSM and satellite imagery.
 * Removes the previous base layer before adding the new one.
 */
export function setBaseLayer(map: L.Map, satellite: boolean): void {
  const prev = baseLayers.get(map)
  if (prev) map.removeLayer(prev)
  const layer = makeTileLayer(satellite)
  layer.addTo(map)
  baseLayers.set(map, layer)
}

/**
 * Create a Leaflet map instance with a base tile layer.
 * Uses canvas renderer for performance with many polygons.
 */
export function createMap(container: HTMLElement, options: MapOptions): L.Map {
  const map = L.map(container, {
    center: options.center,
    zoom: options.zoom,
    preferCanvas: true,
    maxZoom: 19
  })

  setBaseLayer(map, options.satellite ?? false)

  return map
}

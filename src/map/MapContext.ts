import type L from 'leaflet'

/** Injection key for the Leaflet map instance. */
export const MAP_CONTEXT_KEY = Symbol('map-context')

export interface MapContext {
  map: L.Map
}

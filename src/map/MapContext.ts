import type L from 'leaflet'

export const MAP_CONTEXT_KEY = Symbol('map-context')

export interface MapContext {
  map: L.Map
}

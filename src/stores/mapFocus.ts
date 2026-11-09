import { defineStore } from 'pinia'

export interface MapFocusRequest {
  lat: number
  lng: number
  zoom: number
  /** Changes on every request, so asking for the same place twice still moves the map. */
  seq: number
}

/** Lets a sidebar panel ask the map to go somewhere; the map view watches `request`. */
export const useMapFocusStore = defineStore('mapFocus', {
  state: () => ({ request: null as MapFocusRequest | null, seq: 0 }),
  actions: {
    focusOn(lat: number, lng: number, zoom: number): void {
      this.seq++
      this.request = { lat, lng, zoom, seq: this.seq }
    }
  }
})

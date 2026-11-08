import { defineStore } from 'pinia'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../config'

const STORAGE_KEY = 'pogo-s2-planner:settings'

export interface SettingsState {
  center: [number, number]
  zoom: number
  showS14: boolean
  showS17: boolean
  s14MinZoom: number
  s17MinZoom: number
  showPois: boolean
  showOtherPois: boolean
  stopGymOnly: boolean
  showRange: boolean
  rangeRadius: number
  rangeCenter: [number, number] | null
  showPoiImages: boolean
}

function loadFromStorage(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<SettingsState>
  } catch {
    // ignore parse errors
  }
  return {}
}

function persist(state: SettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => {
    const saved = loadFromStorage()
    return {
      center: saved.center ?? DEFAULT_CENTER,
      zoom: saved.zoom ?? DEFAULT_ZOOM,
      showS14: saved.showS14 ?? false,
      showS17: saved.showS17 ?? false,
      s14MinZoom: saved.s14MinZoom ?? 13,
      s17MinZoom: saved.s17MinZoom ?? 16,
      showPois: saved.showPois ?? true,
      showOtherPois: saved.showOtherPois ?? true,
      stopGymOnly: saved.stopGymOnly ?? false,
      showRange: saved.showRange ?? false,
      rangeRadius: saved.rangeRadius ?? 80,
      rangeCenter: saved.rangeCenter ?? null,
      showPoiImages: saved.showPoiImages ?? true
    }
  },
  actions: {
    setCenter(center: [number, number]): void {
      this.center = center
      persist(this.$state)
    },
    setZoom(zoom: number): void {
      this.zoom = zoom
      persist(this.$state)
    },
    toggleS14(): void {
      this.showS14 = !this.showS14
      persist(this.$state)
    },
    toggleS17(): void {
      this.showS17 = !this.showS17
      persist(this.$state)
    },
    setS14MinZoom(zoom: number): void {
      this.s14MinZoom = zoom
      persist(this.$state)
    },
    setS17MinZoom(zoom: number): void {
      this.s17MinZoom = zoom
      persist(this.$state)
    },
    toggleShowPois(): void {
      this.showPois = !this.showPois
      persist(this.$state)
    },
    toggleShowOtherPois(): void {
      this.showOtherPois = !this.showOtherPois
      persist(this.$state)
    },
    toggleStopGymOnly(): void {
      this.stopGymOnly = !this.stopGymOnly
      persist(this.$state)
    },
    toggleShowRange(): void {
      this.showRange = !this.showRange
      persist(this.$state)
    },
    setRangeRadius(radius: number): void {
      this.rangeRadius = Math.max(20, Math.min(500, radius))
      persist(this.$state)
    },
    setRangeCenter(center: [number, number] | null): void {
      this.rangeCenter = center
      persist(this.$state)
    },
    toggleShowPoiImages(): void {
      this.showPoiImages = !this.showPoiImages
      persist(this.$state)
    }
  }
})
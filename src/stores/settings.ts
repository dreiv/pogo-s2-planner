import { defineStore } from 'pinia'
import {
  MARK_STATUS_IDS,
  clampRangeRadius,
  clampZoom,
  parseStoredSettings,
  serializeSettings,
  validateSettings,
  type MarkStatusId,
  type SettingsData
} from '../core/settings'
import { CELL_STATE_FLAG } from '../core/cellVisibility'
import type { CellState } from '../core/classify'

const STORAGE_KEY = 'pogo-s2-planner:settings'

export type SettingsState = SettingsData

function loadFromStorage(): SettingsData {
  try {
    return parseStoredSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    // localStorage unavailable (privacy mode, blocked storage): run with defaults.
    return parseStoredSettings(null)
  }
}

function persist(state: SettingsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSettings(state))
  } catch {
    // storage full or unavailable
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => loadFromStorage(),
  actions: {
    /** Replaces every setting at once (backup restore). Input is validated and clamped. */
    replaceAll(next: unknown): void {
      this.$patch(validateSettings(next))
      persist(this.$state)
    },
    setCenter(center: [number, number]): void {
      this.center = center
      persist(this.$state)
    },
    setZoom(zoom: number): void {
      this.zoom = clampZoom(zoom, this.zoom)
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
      this.s14MinZoom = clampZoom(zoom, this.s14MinZoom)
      persist(this.$state)
    },
    setS17MinZoom(zoom: number): void {
      this.s17MinZoom = clampZoom(zoom, this.s17MinZoom)
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
    toggleShowGyms(): void {
      this.showGyms = !this.showGyms
      persist(this.$state)
    },
    toggleShowStops(): void {
      this.showStops = !this.showStops
      persist(this.$state)
    },
    toggleShowRange(): void {
      this.showRange = !this.showRange
      persist(this.$state)
    },
    setRangeRadius(radius: number): void {
      this.rangeRadius = clampRangeRadius(radius)
      persist(this.$state)
    },
    setRangeCenter(center: [number, number] | null): void {
      this.rangeCenter = center
      persist(this.$state)
    },
    /** Shows/hides the tint of one S17 cell state. */
    toggleCellState(state: CellState): void {
      const key = CELL_STATE_FLAG[state]
      this[key] = !this[key]
      persist(this.$state)
    },
    /** Shows/hides the map outline of one mark status. The marks themselves are untouched. */
    toggleMarkStatus(status: MarkStatusId): void {
      const hidden = new Set<MarkStatusId>(this.hiddenMarkStatuses)
      if (hidden.has(status)) hidden.delete(status)
      else hidden.add(status)
      this.hiddenMarkStatuses = MARK_STATUS_IDS.filter((id) => hidden.has(id))
      persist(this.$state)
    }
  }
})

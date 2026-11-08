import { defineStore } from 'pinia'

const STORAGE_KEY = 'pogo-s2-planner:ui'

const STATE_VERSION = 2

interface UiState {
  version: number
  openSections: Record<string, boolean>
  introDismissed: boolean
}

function load(): Partial<UiState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<UiState>
  } catch {
    return {}
  }
  return {}
}

function persist(state: UiState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => {
    const saved = load()
    return {
      version: STATE_VERSION,
      openSections: saved.version === STATE_VERSION ? (saved.openSections ?? {}) : {},
      introDismissed: saved.introDismissed ?? false
    }
  },
  actions: {
    setOpen(id: string, open: boolean): void {
      this.openSections[id] = open
      persist(this.$state)
    },
    dismissIntro(): void {
      this.introDismissed = true
      persist(this.$state)
    },
    showIntro(): void {
      this.introDismissed = false
      persist(this.$state)
    }
  }
})

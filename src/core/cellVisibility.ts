import type { CellState } from './classify'

/** Which S17 cell states are tinted on the map. A subset of the persisted settings. */
export interface CellVisibility {
  showCellOccupied: boolean
  showCellUncertain: boolean
  showCellFree: boolean
  showCellUnknown: boolean
}

/** The setting that controls each state; one place, so map, legend and store cannot drift. */
export const CELL_STATE_FLAG: Record<CellState, keyof CellVisibility> = {
  occupied: 'showCellOccupied',
  'free-uncertain': 'showCellUncertain',
  free: 'showCellFree',
  unknown: 'showCellUnknown'
}

export function isCellStateVisible(state: CellState, visibility: CellVisibility): boolean {
  return visibility[CELL_STATE_FLAG[state]]
}

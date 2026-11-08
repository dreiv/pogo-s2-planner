import type { CellState } from './core/classify'
import { TRUNCATION_THRESHOLD } from './core/wayfarer/parse'

/** Short names, used by the popup title and the legend. */
export const CELL_STATE_TITLES: Record<CellState, string> = {
  occupied: 'Occupied',
  free: 'Free',
  'free-uncertain': 'Free, data may be incomplete',
  unknown: 'No data'
}

/** One-line status shown next to the selected cell in the Manual marks panel. */
export const OCCUPANCY_TEXT: Record<CellState, string> = {
  occupied: 'Occupied: an active stop or gym is already here',
  free: 'Free: no active stop or gym here',
  'free-uncertain': 'Free, but this S14 cell has incomplete data',
  unknown: 'No data for this area yet'
}

/** Why a cell has its state, in plain words. `s14Count` is the POI count Wayfarer reported. */
export function cellStateExplanation(state: CellState, s14Count?: number | null): string {
  switch (state) {
    case 'occupied':
      return 'An active stop or gym already uses this cell.'
    case 'free':
      return 'No active stop or gym here. A new stop could fit.'
    case 'free-uncertain':
      return typeof s14Count === 'number'
        ? `The S14 cell around it has ${s14Count} POIs (${TRUNCATION_THRESHOLD}+), so Wayfarer may have left some out. A stop could still be hidden here.`
        : `The S14 cell around it has ${TRUNCATION_THRESHOLD}+ POIs, so Wayfarer may have left some out. A stop could still be hidden here.`
    case 'unknown':
      return 'This area is outside the imported data. It is not necessarily free; the app just knows nothing about it.'
  }
}

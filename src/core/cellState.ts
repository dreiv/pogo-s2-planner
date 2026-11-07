import { poiOccupies, type CellState, type ClassifyOptions } from './classify'
import type { ParsedPoi } from './wayfarer/parse'

export interface S14Coverage {
  covered: boolean
  truncated: boolean
}

export function classifyS17Token(
  poisInCell: ParsedPoi[],
  coverage: S14Coverage,
  opts: ClassifyOptions
): CellState {
  if (!coverage.covered) return 'unknown'
  if (poisInCell.some((p) => poiOccupies(p, opts))) return 'occupied'
  return coverage.truncated ? 'free-uncertain' : 'free'
}

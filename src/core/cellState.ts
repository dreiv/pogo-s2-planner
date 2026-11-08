import { poiOccupies, type CellState, type ClassifyOptions } from './classify'
import type { ParsedCell, ParsedPoi } from './wayfarer/parse'

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

/** S14 token -> truncated flag. A token is "covered" iff it is a key of the map. */
export function buildCoverage(cells: readonly ParsedCell[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const c of cells) m.set(c.token, c.truncated)
  return m
}

export interface CellStateResolverInput {
  poisByS17: ReadonlyMap<string, ParsedPoi[]>
  coverage: ReadonlyMap<string, boolean>
  opts: ClassifyOptions
  /** Parent S14 token of an S17 token (`parentToken` from ./s2; injected to keep this pure). */
  parentOf: (token17: string) => string
}

/** Bound on remembered tokens: panning over a whole region must not grow memory forever. */
export const CELL_STATE_CACHE_LIMIT = 20_000

/**
 * Memoized S17 cell state lookup. One resolver is shared by the map and the side panel, so
 * both agree and the POI index / coverage map are built once per dataset revision.
 */
export function createCellStateResolver(input: CellStateResolverInput): (token17: string) => CellState {
  const cache = new Map<string, CellState>()
  return (token17: string): CellState => {
    const hit = cache.get(token17)
    if (hit !== undefined) return hit
    const truncated = input.coverage.get(input.parentOf(token17))
    const state = classifyS17Token(
      input.poisByS17.get(token17) ?? [],
      { covered: truncated !== undefined, truncated: truncated ?? false },
      input.opts
    )
    if (cache.size >= CELL_STATE_CACHE_LIMIT) cache.clear()
    cache.set(token17, state)
    return state
  }
}

/**
 * POI classification — pure, tested.
 * Determines POI kind and S17 cell occupancy.
 */
import type { ParsedPoi } from './wayfarer/parse'
import { cellTokenAt, parentToken } from './s2'

export type PoiKind = 'stop' | 'gym' | 'powerspot' | 'other'

export interface ClassifyOptions {
  /** Whether POWERSPOT counts as occupied. Default: false. */
  powerspotCounts: boolean
  /** Active game brand to match. Default: 'HOLOHOLO'. */
  activeBrand: string
}

export const DEFAULT_CLASSIFY_OPTS: ClassifyOptions = {
  powerspotCounts: false,
  activeBrand: 'HOLOHOLO'
}

/**
 * Classify a single POI by its game objects.
 * - 'stop': has ACTIVE POKESTOP with matching brand
 * - 'gym': has ACTIVE GYM with matching brand
 * - 'powerspot': has ACTIVE POWERSPOT with matching brand
 * - 'other': everything else (no gmo, inactive, wrong brand, etc.)
 */
export function poiKind(poi: ParsedPoi, opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS): PoiKind {
  const active = poi.game.filter((g) => g.status === 'ACTIVE' && g.brand === opts.activeBrand)
  if (active.length === 0) return 'other'

  const entities = new Set(active.map((g) => g.entity))
  if (entities.has('POKESTOP')) return 'stop'
  if (entities.has('GYM')) return 'gym'
  if (entities.has('POWERSPOT')) return 'powerspot'
  return 'other'
}

/**
 * Whether a POI counts as "occupying" a cell for the given options.
 */
export function poiOccupies(
  poi: ParsedPoi,
  opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS
): boolean {
  const kind = poiKind(poi, opts)
  if (kind === 'stop' || kind === 'gym') return true
  if (kind === 'powerspot') return opts.powerspotCounts
  return false
}

export type CellState = 'occupied' | 'free' | 'free-uncertain' | 'unknown'

/**
 * Classify S17 cells as occupied / free / unknown.
 *
 * @param pois All POIs from the dataset.
 * @param coveredS14Tokens Set of S14 tokens that have data (from cells).
 * @param truncatedS14Tokens Set of S14 tokens that are truncated (count >= 50).
 * @param opts Classification options.
 * @returns Map of S17 token → cell state.
 */
export function classifyS17(
  pois: ParsedPoi[],
  coveredS14Tokens: Set<string>,
  truncatedS14Tokens: Set<string>,
  opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS
): Map<string, CellState> {
  const result = new Map<string, CellState>()

  // Group POIs by S17 cell
  const poisByS17 = new Map<string, ParsedPoi[]>()
  for (const poi of pois) {
    const s17 = cellTokenAt(poi.lat, poi.lng, 17)
    const arr = poisByS17.get(s17)
    if (arr) {
      arr.push(poi)
    } else {
      poisByS17.set(s17, [poi])
    }
  }

  // For each S17 cell that has POIs, determine state
  for (const [s17Token, cellPois] of poisByS17) {
    const s14 = parentToken(s17Token, 14)
    const isCovered = coveredS14Tokens.has(s14)
    const isTruncated = truncatedS14Tokens.has(s14)

    if (!isCovered) {
      result.set(s17Token, 'unknown')
      continue
    }

    const hasOccupant = cellPois.some((p) => poiOccupies(p, opts))
    if (hasOccupant) {
      result.set(s17Token, 'occupied')
    } else if (isTruncated) {
      result.set(s17Token, 'free-uncertain')
    } else {
      result.set(s17Token, 'free')
    }
  }

  return result
}

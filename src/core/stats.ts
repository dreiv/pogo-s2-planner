/**
 * S14 statistics — pure, tested.
 * Computes per-S14 POI counts, expected gyms, free S17 cells, and truncation flags.
 */
import type { ParsedPoi, ParsedCell } from './wayfarer/parse'
import { poiKind, poiOccupies, DEFAULT_CLASSIFY_OPTS, type ClassifyOptions } from './classify'
import { parentToken, cellTokenAt } from './s2'
import { s14Children } from './s14Children'
import type { PoiIndex } from './poiIndex'

/**
 * Gym threshold configuration.
 * poiCounts[i] = minimum POI count to expect gymCounts[i] gyms.
 * Default: 2 POI → 1 gym, 6 POI → 2 gyms, 20 POI → 3 gyms.
 */
export interface GymThresholds {
  poiCounts: [number, number, number]
  gymCounts: [number, number, number]
}

export const DEFAULT_THRESHOLDS: GymThresholds = {
  poiCounts: [2, 6, 20],
  gymCounts: [1, 2, 3]
}

/**
 * Statistics for a single S14 cell.
 */
export interface S14Stats {
  /** S14 token. */
  token: string
  /** Number of POKESTOP POIs. */
  stopCount: number
  /** Number of GYM POIs. */
  gymCount: number
  /** Number of other POIs (powerspot, no-gmo, etc.). */
  otherCount: number
  /** Total POI count (stop + gym + other). */
  totalPoi: number
  /** Expected gyms based on thresholds (community rule, not a guarantee). */
  expectedGyms: number
  /** How many more POI needed to reach the next threshold. 0 if at/above max. */
  poiToNextThreshold: number
  /** Number of free S17 cells within this S14. */
  freeS17Count: number
  /** Whether this S14 was flagged as truncated in the Wayfarer export. */
  truncated: boolean
}

/**
 * Options for computing S14 stats.
 */
export interface StatsOptions {
  thresholds: GymThresholds
  classifyOpts: ClassifyOptions
  /** S17 tokens marked as 'propus' or 'in-review' — not counted as free. */
  pendingTokens?: Set<string>
}

export const DEFAULT_STATS_OPTS: StatsOptions = {
  thresholds: DEFAULT_THRESHOLDS,
  classifyOpts: { ...DEFAULT_CLASSIFY_OPTS }
}

/**
 * Compute expected gyms from POI count using thresholds.
 * Returns the number of gyms expected based on which threshold bracket the POI count falls in.
 */
export function expectedGyms(poiCount: number, thresholds: GymThresholds): number {
  let result = 0
  for (let i = 0; i < thresholds.poiCounts.length; i++) {
    if (poiCount >= thresholds.poiCounts[i]!) {
      result = thresholds.gymCounts[i]!
    }
  }
  return result
}

/**
 * Compute how many more POI are needed to reach the next threshold.
 * Returns 0 if already at or above the highest threshold.
 */
export function poiToNextThreshold(poiCount: number, thresholds: GymThresholds): number {
  for (let i = 0; i < thresholds.poiCounts.length; i++) {
    if (poiCount < thresholds.poiCounts[i]!) {
      return thresholds.poiCounts[i]! - poiCount
    }
  }
  return 0
}

/** Group POIs by S14 parent token (used when no pre-computed index is provided). */
function groupPoisByS14(pois: ParsedPoi[]): Map<string, ParsedPoi[]> {
  const m = new Map<string, ParsedPoi[]>()
  for (const poi of pois) {
    const s14 = parentToken(poi.cellToken, 14)
    const arr = m.get(s14)
    if (arr) {
      arr.push(poi)
    } else {
      m.set(s14, [poi])
    }
  }
  return m
}

/**
 * Compute S14 statistics for all S14 cells in the dataset.
 *
 * @param pois - All POIs in the dataset.
 * @param cells - All S14 cells (for truncation flags).
 * @param opts - Threshold and classification options.
 * @returns Map from S14 token to stats.
 */
export function computeS14Stats(
  pois: ParsedPoi[],
  cells: ParsedCell[],
  opts: StatsOptions = DEFAULT_STATS_OPTS,
  index?: PoiIndex
): Map<string, S14Stats> {
  const { thresholds, classifyOpts } = opts

  // Truncated S14 tokens
  const truncatedSet = new Set(cells.filter((c) => c.truncated).map((c) => c.token))

  // Use pre-computed index if provided, otherwise group POIs by S14 parent token
  const byS14 = index?.poisByS14 ?? groupPoisByS14(pois)

  // Also include S14 cells that have no POIs (from the cells list)
  for (const cell of cells) {
    if (!byS14.has(cell.token)) {
      byS14.set(cell.token, [])
    }
  }

  const result = new Map<string, S14Stats>()

  for (const [s14Token, s14Pois] of byS14) {
    let stopCount = 0
    let gymCount = 0
    let otherCount = 0

    for (const poi of s14Pois) {
      const kind = poiKind(poi, classifyOpts)
      if (kind === 'stop') stopCount++
      else if (kind === 'gym') gymCount++
      else otherCount++
    }

    const totalPoi = stopCount + gymCount + otherCount
    const expGyms = expectedGyms(totalPoi, thresholds)
    const toNext = poiToNextThreshold(totalPoi, thresholds)

    // Count free S17 cells: enumerate all 64 S17 children, check occupancy
    const s17Tokens = s14Children(s14Token)
    const isTruncated = truncatedSet.has(s14Token)

    // Build a set of S17 tokens that have occupying POIs
    const occupiedS17 = new Set<string>()
    for (const poi of s14Pois) {
      if (poiOccupies(poi, classifyOpts)) {
        const s17 = cellTokenAt(poi.lat, poi.lng, 17)
        occupiedS17.add(s17)
      }
    }

    const pending = opts.pendingTokens
    let freeS17Count = 0
    for (const s17 of s17Tokens) {
      if (!occupiedS17.has(s17) && !isTruncated && !pending?.has(s17)) {
        freeS17Count++
      }
    }

    result.set(s14Token, {
      token: s14Token,
      stopCount,
      gymCount,
      otherCount,
      totalPoi,
      expectedGyms: expGyms,
      poiToNextThreshold: toNext,
      freeS17Count,
      truncated: isTruncated
    })
  }

  return result
}

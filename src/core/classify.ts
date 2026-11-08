import type { ParsedPoi } from './wayfarer/parse'
import { cellTokenAt, parentToken } from './s2'
import type { PoiIndex } from './poiIndex'

export type PoiKind = 'stop' | 'gym' | 'powerspot' | 'other'

/** Brand used by real Wayfarer exports (matched case-insensitively). */
export const DEFAULT_ACTIVE_BRAND = 'HOLOHOLO'

export interface ClassifyOptions {
  activeBrand: string
}

export const DEFAULT_CLASSIFY_OPTS: ClassifyOptions = {
  activeBrand: DEFAULT_ACTIVE_BRAND
}

/** A missing/empty brand counts as a match, so exports that omit it still classify. */
function isActiveGame(g: ParsedPoi['game'][number], opts: ClassifyOptions): boolean {
  if (g.status !== 'ACTIVE') return false
  if (!g.brand) return true
  return g.brand.toUpperCase() === opts.activeBrand.toUpperCase()
}

export function poiKind(poi: ParsedPoi, opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS): PoiKind {
  const active = poi.game.filter((g) => isActiveGame(g, opts))
  if (active.length === 0) return 'other'

  const entities = new Set(active.map((g) => g.entity))
  if (entities.has('POKESTOP')) return 'stop'
  if (entities.has('GYM')) return 'gym'
  if (entities.has('POWERSPOT')) return 'powerspot'
  return 'other'
}

export function poiOccupies(
  poi: ParsedPoi,
  opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS
): boolean {
  const kind = poiKind(poi, opts)
  if (kind === 'stop' || kind === 'gym') return true
  return false
}

export type CellState = 'occupied' | 'free' | 'free-uncertain' | 'unknown'

function groupPoisByS17(pois: ParsedPoi[]): Map<string, ParsedPoi[]> {
  const m = new Map<string, ParsedPoi[]>()
  for (const poi of pois) {
    const s17 = cellTokenAt(poi.lat, poi.lng, 17)
    const arr = m.get(s17)
    if (arr) {
      arr.push(poi)
    } else {
      m.set(s17, [poi])
    }
  }
  return m
}

export function classifyS17(
  pois: ParsedPoi[],
  coveredS14Tokens: Set<string>,
  truncatedS14Tokens: Set<string>,
  opts: ClassifyOptions = DEFAULT_CLASSIFY_OPTS,
  index?: PoiIndex
): Map<string, CellState> {
  const result = new Map<string, CellState>()

  const poisByS17 = index?.poisByS17 ?? groupPoisByS17(pois)

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

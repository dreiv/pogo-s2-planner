import { poiOccupies } from './classify'
import type { ParsedPoi } from './wayfarer/parse'

/** Active stops + gyms an S14 cell needs for its 1st, 2nd and 3rd gym (community rule). */
export const GYM_TIERS = [2, 6, 20] as const

/** Defaults: no hint below 3 stops/gyms, and only when at most 3 more unlock the next gym. */
export const GYM_HINT_MIN_COUNT = 3
export const GYM_HINT_MAX_REMAINING = 3

/** Limits for the two settings (the UI offers every integer in these ranges). */
export const GYM_HINT_MIN_COUNT_RANGE = [1, 10] as const
export const GYM_HINT_MAX_REMAINING_RANGE = [1, 5] as const

export interface GymHintOptions {
  /** A cell needs at least this many active stops + gyms to get a hint. */
  minCount: number
  /** A hint needs at most this many more stops/gyms to unlock the next gym. */
  maxRemaining: number
}

export const DEFAULT_GYM_HINT_OPTIONS: GymHintOptions = {
  minCount: GYM_HINT_MIN_COUNT,
  maxRemaining: GYM_HINT_MAX_REMAINING
}

export interface GymHint {
  /** Active stops + gyms in the S14 cell now. */
  count: number
  /** How many more are needed for the next gym (>= 1). */
  remaining: number
  gymsNow: number
  gymsNext: number
}

export function gymsForCount(count: number): number {
  return GYM_TIERS.filter((tier) => count >= tier).length
}

/** Distance to the next gym tier, with no thresholds; null once every tier is unlocked. */
export function nextGym(count: number): GymHint | null {
  const next = GYM_TIERS.find((tier) => tier > count)
  if (next === undefined) return null
  const gymsNow = gymsForCount(count)
  return { count, remaining: next - count, gymsNow, gymsNext: gymsNow + 1 }
}

export function isHintShown(h: GymHint, opts: GymHintOptions): boolean {
  return h.count >= opts.minCount && h.remaining <= opts.maxRemaining
}

/** The hint for a cell with `count` stops/gyms, or null when no gym is close (or all unlocked). */
export function gymHint(
  count: number,
  minCount: number = GYM_HINT_MIN_COUNT,
  maxRemaining: number = GYM_HINT_MAX_REMAINING
): GymHint | null {
  const h = nextGym(count)
  return h && isHintShown(h, { minCount, maxRemaining }) ? h : null
}

/**
 * Zoomed out, only the closest hints are drawn so badges do not pile up over a dense city:
 * "+1" below zoom 14, up to "+2" at zoom 14, everything the setting allows from zoom 15.
 */
export function gymHintDeclutterLimit(zoom: number, maxRemaining: number): number {
  const z = Math.floor(zoom)
  if (z >= 15) return maxRemaining
  if (z >= 14) return Math.min(maxRemaining, 2)
  return Math.min(maxRemaining, 1)
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export interface GymHintCell {
  token: string
  lat: number
  lng: number
  hint: GymHint
  /** POIs (any kind) Wayfarer reports for the cell. */
  reported: number
  /** POIs (any kind) actually imported for the cell. */
  imported: number
  /** True when the export lacks some of the cell's POIs, so the real count may be higher. */
  partial: boolean
}

/** Short badge text: "+2 → 2nd gym", or "+2? → 2nd gym" when the cell's data is partial. */
export function gymHintLabel(cell: Pick<GymHintCell, 'hint' | 'partial'>): string {
  return `+${cell.hint.remaining}${cell.partial ? '?' : ''} → ${ordinal(cell.hint.gymsNext)} gym`
}

/** Plain-language sentence for popups and the opportunities list. */
export function gymHintText(cell: GymHintCell): string {
  const { hint } = cell
  const more = hint.remaining === 1 ? '1 more stop' : `${hint.remaining} more stops`
  const base = `This S14 cell has ${hint.count} stops and gyms. With ${more} it would get its ${ordinal(hint.gymsNext)} gym.`
  return cell.partial
    ? `${base} Wayfarer reports ${cell.reported} POIs here but only ${cell.imported} were imported, so the real count may be higher.`
    : base
}

/**
 * Every S14 cell with imported data that has not unlocked all its gyms yet (and has at least one
 * active stop or gym); `filterGymHints` then applies the person's thresholds. `reportedCounts`
 * maps each imported S14 token to the POI count Wayfarer reports for it. `centerOf` is injected
 * (`cellCenter` from ./s2) to keep this module free of the S2 library.
 */
export function computeGymHints(
  poisByS14: ReadonlyMap<string, ParsedPoi[]>,
  reportedCounts: ReadonlyMap<string, number>,
  centerOf: (token: string) => [number, number]
): GymHintCell[] {
  const out: GymHintCell[] = []
  for (const [token, pois] of poisByS14) {
    const reported = reportedCounts.get(token)
    if (reported === undefined) continue
    const count = pois.filter((p) => poiOccupies(p)).length
    if (count < 1) continue
    const hint = nextGym(count)
    if (!hint) continue
    const [lat, lng] = centerOf(token)
    out.push({
      token,
      lat,
      lng,
      hint,
      reported,
      imported: pois.length,
      partial: reported > pois.length
    })
  }
  return out
}

export function filterGymHints(cells: readonly GymHintCell[], opts: GymHintOptions): GymHintCell[] {
  return cells.filter((c) => isHintShown(c.hint, opts))
}

/** Closest to a gym first, then the fuller cell, then a stable order by token. */
export function sortGymHints(cells: readonly GymHintCell[]): GymHintCell[] {
  return [...cells].sort(
    (a, b) =>
      a.hint.remaining - b.hint.remaining ||
      b.hint.count - a.hint.count ||
      (a.token < b.token ? -1 : a.token > b.token ? 1 : 0)
  )
}

import { poiOccupies } from './classify'
import type { ParsedPoi } from './wayfarer/parse'

/** Active stops + gyms an S14 cell needs for its 1st, 2nd and 3rd gym (community rule). */
export const GYM_TIERS = [2, 6, 20] as const

/** No hint below this many stops/gyms in the cell: a nearly empty cell is not "about to" change. */
export const GYM_HINT_MIN_COUNT = 3
/** A hint appears once this many (or fewer) more stops/gyms would unlock the next gym. */
export const GYM_HINT_MAX_REMAINING = 3

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

/** The hint for a cell with `count` stops/gyms, or null when no gym is close (or all are unlocked). */
export function gymHint(
  count: number,
  minCount: number = GYM_HINT_MIN_COUNT,
  maxRemaining: number = GYM_HINT_MAX_REMAINING
): GymHint | null {
  if (count < minCount) return null
  const next = GYM_TIERS.find((tier) => tier > count)
  if (next === undefined) return null
  const remaining = next - count
  if (remaining > maxRemaining) return null
  const gymsNow = gymsForCount(count)
  return { count, remaining, gymsNow, gymsNext: gymsNow + 1 }
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

/** Short badge text, e.g. "+2 → 2nd gym". */
export function gymHintLabel(h: GymHint): string {
  return `+${h.remaining} → ${ordinal(h.gymsNext)} gym`
}

/** Plain-language sentence for popups. */
export function gymHintText(h: GymHint): string {
  const more = h.remaining === 1 ? '1 more stop' : `${h.remaining} more stops`
  return `This S14 cell has ${h.count} stops and gyms. With ${more} it would get its ${ordinal(h.gymsNext)} gym.`
}

export interface GymHintCell {
  token: string
  lat: number
  lng: number
  hint: GymHint
}

/**
 * Hints for every S14 cell that has imported data and is close to its next gym.
 * `centerOf` is injected (`cellCenter` from ./s2) to keep this module free of the S2 library.
 */
export function computeGymHints(
  poisByS14: ReadonlyMap<string, ParsedPoi[]>,
  coverage: ReadonlyMap<string, boolean>,
  centerOf: (token: string) => [number, number]
): GymHintCell[] {
  const out: GymHintCell[] = []
  for (const [token, pois] of poisByS14) {
    if (!coverage.has(token)) continue
    const hint = gymHint(pois.filter((p) => poiOccupies(p)).length)
    if (!hint) continue
    const [lat, lng] = centerOf(token)
    out.push({ token, lat, lng, hint })
  }
  return out
}

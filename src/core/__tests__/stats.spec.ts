import { describe, it, expect } from 'vitest'
import {
  computeS14Stats,
  expectedGyms,
  poiToNextThreshold,
  DEFAULT_THRESHOLDS,
  type GymThresholds
} from '../stats'
import type { ParsedPoi, ParsedCell } from '../wayfarer/parse'
import { cellTokenAt, parentToken } from '../s2'

// --- Helpers ---

let idCounter = 0
function makePoi(lat: number, lng: number, game: ParsedPoi['game'] = []): ParsedPoi {
  idCounter++
  const cellToken = cellTokenAt(lat, lng, 17)
  return {
    id: `poi-${idCounter}`,
    lat,
    lng,
    title: '',
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game,
    cellToken
  }
}

function activeStop(): ParsedPoi['game'][number] {
  return { entity: 'POKESTOP', status: 'ACTIVE', brand: 'POKEMON' }
}

function activeGym(): ParsedPoi['game'][number] {
  return { entity: 'GYM', status: 'ACTIVE', brand: 'POKEMON' }
}

function activePowerSpot(): ParsedPoi['game'][number] {
  return { entity: 'POWERSPOT', status: 'ACTIVE', brand: 'POKEMON' }
}

function makeCell(token: string, truncated = false): ParsedCell {
  return {
    token,
    count: truncated ? 50 : 10,
    truncated,
    generatedTimestamp: null,
    snapshot: null,
    level: 14
  }
}

/** Create N stops at slightly different positions within the same S14. */
function makeStops(n: number, baseLat: number, baseLng: number): ParsedPoi[] {
  const pois: ParsedPoi[] = []
  for (let i = 0; i < n; i++) {
    // Spread within ~0.0001 degrees (~10m) to stay in same S14
    const lat = baseLat + i * 0.00005
    const lng = baseLng + i * 0.00005
    pois.push(makePoi(lat, lng, [activeStop()]))
  }
  return pois
}

/** Create N gyms at slightly different positions within the same S14. */
function makeGyms(n: number, baseLat: number, baseLng: number): ParsedPoi[] {
  const pois: ParsedPoi[] = []
  for (let i = 0; i < n; i++) {
    const lat = baseLat + i * 0.00005
    const lng = baseLng + i * 0.00005
    pois.push(makePoi(lat, lng, [activeGym()]))
  }
  return pois
}

/** Get the S14 token for a given lat/lng. */
function s14Of(lat: number, lng: number): string {
  return parentToken(cellTokenAt(lat, lng, 17), 14)
}

// --- Tests ---

describe('expectedGyms', () => {
  it('returns 0 for 0 POI', () => {
    expect(expectedGyms(0, DEFAULT_THRESHOLDS)).toBe(0)
  })

  it('returns 1 at exactly 2 POI', () => {
    expect(expectedGyms(2, DEFAULT_THRESHOLDS)).toBe(1)
  })

  it('returns 1 at 5 POI (below 6)', () => {
    expect(expectedGyms(5, DEFAULT_THRESHOLDS)).toBe(1)
  })

  it('returns 2 at exactly 6 POI', () => {
    expect(expectedGyms(6, DEFAULT_THRESHOLDS)).toBe(2)
  })

  it('returns 2 at 19 POI (below 20)', () => {
    expect(expectedGyms(19, DEFAULT_THRESHOLDS)).toBe(2)
  })

  it('returns 3 at exactly 20 POI', () => {
    expect(expectedGyms(20, DEFAULT_THRESHOLDS)).toBe(3)
  })

  it('returns 3 above 20 POI', () => {
    expect(expectedGyms(25, DEFAULT_THRESHOLDS)).toBe(3)
  })

  it('respects custom thresholds', () => {
    const custom: GymThresholds = {
      poiCounts: [3, 8, 15],
      gymCounts: [1, 2, 4]
    }
    expect(expectedGyms(0, custom)).toBe(0)
    expect(expectedGyms(3, custom)).toBe(1)
    expect(expectedGyms(8, custom)).toBe(2)
    expect(expectedGyms(15, custom)).toBe(4)
  })
})

describe('poiToNextThreshold', () => {
  it('returns 2 for 0 POI (next threshold is 2)', () => {
    expect(poiToNextThreshold(0, DEFAULT_THRESHOLDS)).toBe(2)
  })

  it('returns 1 for 1 POI', () => {
    expect(poiToNextThreshold(1, DEFAULT_THRESHOLDS)).toBe(1)
  })

  it('returns 4 for 2 POI (next is 6)', () => {
    expect(poiToNextThreshold(2, DEFAULT_THRESHOLDS)).toBe(4)
  })

  it('returns 0 for 20 POI (at max threshold)', () => {
    expect(poiToNextThreshold(20, DEFAULT_THRESHOLDS)).toBe(0)
  })

  it('returns 0 above max threshold', () => {
    expect(poiToNextThreshold(25, DEFAULT_THRESHOLDS)).toBe(0)
  })
})

describe('computeS14Stats', () => {
  const BASE_LAT = 45.7
  const BASE_LNG = 21.3

  it('returns empty map for no POIs and no cells', () => {
    const stats = computeS14Stats([], [])
    expect(stats.size).toBe(0)
  })

  it('computes stats for 0 POI in a cell', () => {
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats([], cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.stopCount).toBe(0)
    expect(s!.gymCount).toBe(0)
    expect(s!.totalPoi).toBe(0)
    expect(s!.expectedGyms).toBe(0)
    expect(s!.poiToNextThreshold).toBe(2)
    expect(s!.freeS17Count).toBe(64)
    expect(s!.truncated).toBe(false)
  })

  it('computes stats for 1 POI under threshold', () => {
    const pois = makeStops(1, BASE_LAT, BASE_LNG)
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.stopCount).toBe(1)
    expect(s!.gymCount).toBe(0)
    expect(s!.totalPoi).toBe(1)
    expect(s!.expectedGyms).toBe(0)
    expect(s!.poiToNextThreshold).toBe(1)
    // 1 POI occupies 1 S17 cell → 63 free
    expect(s!.freeS17Count).toBe(63)
  })

  it('computes stats at exact threshold (2 POI → 1 gym expected)', () => {
    const pois = makeStops(2, BASE_LAT, BASE_LNG)
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.totalPoi).toBe(2)
    expect(s!.expectedGyms).toBe(1)
    expect(s!.poiToNextThreshold).toBe(4)
  })

  it('computes stats at 6 POI (→ 2 gyms expected)', () => {
    const pois = makeStops(6, BASE_LAT, BASE_LNG)
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.totalPoi).toBe(6)
    expect(s!.expectedGyms).toBe(2)
    expect(s!.poiToNextThreshold).toBe(14)
  })

  it('computes stats at 20 POI (→ 3 gyms expected)', () => {
    const pois = makeStops(20, BASE_LAT, BASE_LNG)
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.totalPoi).toBe(20)
    expect(s!.expectedGyms).toBe(3)
    expect(s!.poiToNextThreshold).toBe(0)
  })

  it('computes stats above 20 POI', () => {
    // Use tighter spread to stay within one S14
    const pois: ParsedPoi[] = []
    for (let i = 0; i < 25; i++) {
      const lat = BASE_LAT + i * 0.00002
      const lng = BASE_LNG + i * 0.00002
      pois.push(makePoi(lat, lng, [activeStop()]))
    }
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.totalPoi).toBe(25)
    expect(s!.expectedGyms).toBe(3)
    expect(s!.poiToNextThreshold).toBe(0)
  })

  it('counts gyms separately from stops', () => {
    const stops = makeStops(3, BASE_LAT, BASE_LNG)
    const gyms = makeGyms(2, BASE_LAT + 0.001, BASE_LNG + 0.001)
    const pois = [...stops, ...gyms]
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.stopCount).toBe(3)
    expect(s!.gymCount).toBe(2)
    expect(s!.totalPoi).toBe(5)
    expect(s!.expectedGyms).toBe(1)
  })

  it('counts powerspots as other', () => {
    const stops = makeStops(2, BASE_LAT, BASE_LNG)
    const ps = makePoi(BASE_LAT + 0.001, BASE_LNG + 0.001, [activePowerSpot()])
    const pois = [...stops, ps]
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.stopCount).toBe(2)
    expect(s!.otherCount).toBe(1)
    expect(s!.totalPoi).toBe(3)
  })

  it('flags truncated cells', () => {
    const pois = makeStops(1, BASE_LAT, BASE_LNG)
    const token = s14Of(BASE_LAT, BASE_LNG)
    const cells = [makeCell(token, true)]
    const stats = computeS14Stats(pois, cells)

    const s = stats.get(token)
    expect(s).toBeDefined()
    expect(s!.truncated).toBe(true)
    // Truncated → no free cells counted
    expect(s!.freeS17Count).toBe(0)
  })

  it('handles multiple S14 cells independently', () => {
    // Two POIs in different S14 cells
    const poi1 = makePoi(45.7, 21.3, [activeStop()])
    const poi2 = makePoi(45.71, 21.31, [activeStop()])

    const token1 = s14Of(45.7, 21.3)
    const token2 = s14Of(45.71, 21.31)

    if (token1 === token2) {
      // If they happen to be in the same S14, skip
      return
    }

    const cells = [makeCell(token1), makeCell(token2)]
    const stats = computeS14Stats([poi1, poi2], cells)

    const s1 = stats.get(token1)
    const s2 = stats.get(token2)
    expect(s1).toBeDefined()
    expect(s2).toBeDefined()
    expect(s1!.totalPoi).toBe(1)
    expect(s2!.totalPoi).toBe(1)
  })
})

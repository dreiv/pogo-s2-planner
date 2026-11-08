// Deterministic synthetic dataset (seeded LCG, no Math.random) for benchmarks.
import type { ParsedCell, ParsedPoi, ParsedGameObject } from '../../wayfarer/parse'
import { cellTokenAt } from '../../s2'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function makeSyntheticDataset(
  nPois: number,
  seed = 1
): {
  cells: ParsedCell[]
  pois: ParsedPoi[]
} {
  const rand = lcg(seed)

  // Rectangle: lat 45.70–45.80, lng 21.15–21.30
  const latMin = 45.7
  const latMax = 45.8
  const lngMin = 21.15
  const lngMax = 21.3

  const pois: ParsedPoi[] = []
  const cellMap = new Map<string, number>()

  for (let i = 0; i < nPois; i++) {
    const lat = latMin + rand() * (latMax - latMin)
    const lng = lngMin + rand() * (lngMax - lngMin)
    const s14 = cellTokenAt(lat, lng, 14)

    // Mix: 55% POKESTOP ACTIVE, 8% GYM ACTIVE, 7% POWERSPOT (half INACTIVE), 30% game: []
    const roll = rand()
    let game: ParsedGameObject[]
    if (roll < 0.55) {
      game = [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    } else if (roll < 0.63) {
      game = [{ entity: 'GYM', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    } else if (roll < 0.7) {
      const status = rand() < 0.5 ? 'INACTIVE' : 'ACTIVE'
      game = [{ entity: 'POWERSPOT', status, brand: 'HOLOHOLO' }]
    } else {
      game = []
    }

    const poi: ParsedPoi = {
      id: `synthetic-${i}`,
      lat,
      lng,
      title: `Synthetic POI ${i}`,
      description: '',
      address: '',
      imageUrl: '',
      communityContributed: false,
      game,
      cellToken: s14
    }
    pois.push(poi)

    cellMap.set(s14, (cellMap.get(s14) ?? 0) + 1)
  }

  const cells: ParsedCell[] = []
  for (const [token, count] of cellMap) {
    cells.push({
      token,
      count,
      truncated: count >= 50,
      generatedTimestamp: null,
      snapshot: null,
      level: 14
    })
  }

  return { cells, pois }
}

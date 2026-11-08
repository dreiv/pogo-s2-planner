import type { ParsedPoi } from './wayfarer/parse'
import { cellTokenAt, parentToken } from './s2'

export interface PoiIndex {
  poisByS17: Map<string, ParsedPoi[]>
  poisByS14: Map<string, ParsedPoi[]>
}

export function buildPoiIndex(pois: ParsedPoi[]): PoiIndex {
  const poisByS17 = new Map<string, ParsedPoi[]>()
  const poisByS14 = new Map<string, ParsedPoi[]>()

  for (const poi of pois) {
    const s17 = cellTokenAt(poi.lat, poi.lng, 17)
    const s14 = parentToken(s17, 14)

    let arr17 = poisByS17.get(s17)
    if (!arr17) {
      arr17 = []
      poisByS17.set(s17, arr17)
    }
    arr17.push(poi)

    let arr14 = poisByS14.get(s14)
    if (!arr14) {
      arr14 = []
      poisByS14.set(s14, arr14)
    }
    arr14.push(poi)
  }

  return { poisByS17, poisByS14 }
}

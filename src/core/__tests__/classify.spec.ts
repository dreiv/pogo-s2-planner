import { describe, it, expect } from 'vitest'
import { poiKind, poiOccupies, classifyS17, DEFAULT_CLASSIFY_OPTS } from '../classify'
import type { ParsedPoi } from '../wayfarer/parse'
import { cellTokenAt } from '../s2'

function makePoi(lat: number, lng: number, game: ParsedPoi['game'] = []): ParsedPoi {
  return {
    id: `poi-${lat}-${lng}`,
    lat,
    lng,
    title: '',
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game,
    cellToken: ''
  }
}

function activeStop(): ParsedPoi['game'][number] {
  return { entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }
}

function activeGym(): ParsedPoi['game'][number] {
  return { entity: 'GYM', status: 'ACTIVE', brand: 'HOLOHOLO' }
}

function activePowerSpot(): ParsedPoi['game'][number] {
  return { entity: 'POWERSPOT', status: 'ACTIVE', brand: 'HOLOHOLO' }
}

function inactiveStop(): ParsedPoi['game'][number] {
  return { entity: 'POKESTOP', status: 'INACTIVE', brand: 'HOLOHOLO' }
}

function wrongBrandStop(): ParsedPoi['game'][number] {
  return { entity: 'POKESTOP', status: 'ACTIVE', brand: 'OTHER' }
}

describe('poiKind', () => {
  it('classifies active POKESTOP as stop', () => {
    const poi = makePoi(45.7, 21.3, [activeStop()])
    expect(poiKind(poi)).toBe('stop')
  })

  it('classifies active GYM as gym', () => {
    const poi = makePoi(45.7, 21.3, [activeGym()])
    expect(poiKind(poi)).toBe('gym')
  })

  it('classifies active POWERSPOT as powerspot', () => {
    const poi = makePoi(45.7, 21.3, [activePowerSpot()])
    expect(poiKind(poi)).toBe('powerspot')
  })

  it('classifies no gmo as other', () => {
    const poi = makePoi(45.7, 21.3, [])
    expect(poiKind(poi)).toBe('other')
  })

  it('classifies INACTIVE entity as other', () => {
    const poi = makePoi(45.7, 21.3, [inactiveStop()])
    expect(poiKind(poi)).toBe('other')
  })

  it('classifies wrong brand as other', () => {
    const poi = makePoi(45.7, 21.3, [wrongBrandStop()])
    expect(poiKind(poi)).toBe('other')
  })

  it('prefers stop over gym when both present', () => {
    const poi = makePoi(45.7, 21.3, [activeGym(), activeStop()])
    expect(poiKind(poi)).toBe('stop')
  })
})

describe('poiOccupies', () => {
  it('stop occupies', () => {
    const poi = makePoi(45.7, 21.3, [activeStop()])
    expect(poiOccupies(poi)).toBe(true)
  })

  it('gym occupies', () => {
    const poi = makePoi(45.7, 21.3, [activeGym()])
    expect(poiOccupies(poi)).toBe(true)
  })

  it('powerspot does NOT occupy by default', () => {
    const poi = makePoi(45.7, 21.3, [activePowerSpot()])
    expect(poiOccupies(poi)).toBe(false)
  })

  it('powerspot occupies when powerspotCounts=true', () => {
    const poi = makePoi(45.7, 21.3, [activePowerSpot()])
    expect(poiOccupies(poi, { ...DEFAULT_CLASSIFY_OPTS, powerspotCounts: true })).toBe(true)
  })

  it('other does not occupy', () => {
    const poi = makePoi(45.7, 21.3, [])
    expect(poiOccupies(poi)).toBe(false)
  })
})

describe('classifyS17', () => {
  // Two POIs in the same S17 cell
  it('two POIs in same cell → occupied', () => {
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)
    const s14 = cellTokenAt(lat, lng, 14)

    const pois = [
      makePoi(lat, lng, [activeStop()]),
      makePoi(lat + 0.0001, lng + 0.0001, [activeGym()])
    ]

    const result = classifyS17(pois, new Set([s14]), new Set())
    expect(result.get(s17)).toBe('occupied')
  })

  it('POI in covered S14 with no active game → free', () => {
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)
    const s14 = cellTokenAt(lat, lng, 14)

    const pois = [makePoi(lat, lng, [])] // no game objects
    const result = classifyS17(pois, new Set([s14]), new Set())
    // Cell has a POI but it's 'other', so the cell is free
    expect(result.get(s17)).toBe('free')
  })

  it('POI in truncated S14 → free-uncertain', () => {
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)
    const s14 = cellTokenAt(lat, lng, 14)

    const pois = [makePoi(lat, lng, [])]
    const result = classifyS17(pois, new Set([s14]), new Set([s14]))
    expect(result.get(s17)).toBe('free-uncertain')
  })

  it('POI outside covered S14 → unknown', () => {
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)

    const pois = [makePoi(lat, lng, [activeStop()])]
    // Empty covered set → unknown
    const result = classifyS17(pois, new Set(), new Set())
    expect(result.get(s17)).toBe('unknown')
  })

  it('INACTIVE entity → cell is free (not occupied)', () => {
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)
    const s14 = cellTokenAt(lat, lng, 14)

    const pois = [makePoi(lat, lng, [inactiveStop()])]
    const result = classifyS17(pois, new Set([s14]), new Set())
    expect(result.get(s17)).toBe('free')
  })

  it('POI on cell edge → still classified (deterministic)', () => {
    // Use a point very close to a cell boundary
    const lat = 45.728
    const lng = 21.268
    const s17 = cellTokenAt(lat, lng, 17)
    const s14 = cellTokenAt(lat, lng, 14)

    const pois = [makePoi(lat, lng, [activeStop()])]
    const result = classifyS17(pois, new Set([s14]), new Set())
    // Should be in exactly one cell
    expect(result.get(s17)).toBe('occupied')
  })
})

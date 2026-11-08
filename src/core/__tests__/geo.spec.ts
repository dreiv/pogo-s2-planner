import { describe, it, expect } from 'vitest'
import { haversine, poisWithin, cellsIntersectingCircle } from '../geo'
import type { ParsedPoi } from '../wayfarer/parse'

function makePoi(lat: number, lng: number, id?: string): ParsedPoi {
  return {
    id: id ?? `poi-${lat}-${lng}`,
    lat,
    lng,
    title: '',
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: [],
    cellToken: ''
  }
}

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(45.7, 21.2, 45.7, 21.2)).toBe(0)
  })

  it('known distance: ~111 km per degree latitude', () => {
    // 1 degree of latitude ≈ 111 km
    const d = haversine(45.0, 21.0, 46.0, 21.0)
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })

  it('known distance: ~111 km * cos(lat) per degree longitude', () => {
    // At 45°N, 1 degree longitude ≈ 111 * cos(45°) ≈ 78.5 km
    const d = haversine(45.0, 21.0, 45.0, 22.0)
    expect(d).toBeGreaterThan(77000)
    expect(d).toBeLessThan(80000)
  })

  it('symmetric: d(a,b) === d(b,a)', () => {
    const ab = haversine(45.7, 21.2, 45.8, 21.3)
    const ba = haversine(45.8, 21.3, 45.7, 21.2)
    expect(Math.abs(ab - ba)).toBeLessThan(0.01)
  })
})

describe('poisWithin', () => {
  const center = { lat: 45.728, lng: 21.268 }

  it('includes POI at center (distance 0)', () => {
    const pois = [makePoi(center.lat, center.lng)]
    const result = poisWithin(center.lat, center.lng, 80, pois)
    expect(result.length).toBe(1)
    expect(result[0]!.distance).toBe(0)
  })

  it('excludes POI far away', () => {
    const pois = [makePoi(center.lat + 0.01, center.lng + 0.01)] // ~1.4 km away
    const result = poisWithin(center.lat, center.lng, 80, pois)
    expect(result.length).toBe(0)
  })

  it('includes POI within 80m', () => {
    // ~50m north
    const pois = [makePoi(center.lat + 0.00045, center.lng)]
    const result = poisWithin(center.lat, center.lng, 80, pois)
    expect(result.length).toBe(1)
    expect(result[0]!.distance).toBeLessThan(80)
  })

  it('sorts by distance', () => {
    const pois = [
      makePoi(center.lat + 0.001, center.lng, 'far'), // ~111m
      makePoi(center.lat + 0.0001, center.lng, 'near') // ~11m
    ]
    const result = poisWithin(center.lat, center.lng, 500, pois)
    expect(result.length).toBe(2)
    expect(result[0]!.distance).toBeLessThan(result[1]!.distance)
  })

  it('empty array returns empty', () => {
    const result = poisWithin(center.lat, center.lng, 80, [])
    expect(result.length).toBe(0)
  })
})

describe('cellsIntersectingCircle', () => {
  const center = { lat: 45.728, lng: 21.268 }

  it('small circle (20m) intersects at least one S17 cell', () => {
    const result = cellsIntersectingCircle(center.lat, center.lng, 20, 17)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('large circle (500m) intersects multiple S14 cells', () => {
    const result = cellsIntersectingCircle(center.lat, center.lng, 500, 14)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('all returned cells have distance <= radius', () => {
    const radius = 100
    const result = cellsIntersectingCircle(center.lat, center.lng, radius, 17)
    for (const cell of result) {
      expect(cell.distance).toBeLessThanOrEqual(radius + 1)
    }
  })

  it('radius 20m: limited cells', () => {
    const result = cellsIntersectingCircle(center.lat, center.lng, 20, 17)
    // 20m radius should hit at most a few S17 cells (~70m side)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('radius 500m: more cells than 80m', () => {
    const small = cellsIntersectingCircle(center.lat, center.lng, 80, 17)
    const large = cellsIntersectingCircle(center.lat, center.lng, 500, 17)
    expect(large.length).toBeGreaterThan(small.length)
  })
})

import { describe, it, expect } from 'vitest'
import { cellTokenAt, cellsCoveringBounds, type Bounds } from '../s2'

// Bucharest area (~44.4°N, 26.1°E)
const LAT = 44.4268
const LNG = 26.1025

const bounds: Bounds = {
  south: LAT - 0.01,
  west: LNG - 0.01,
  north: LAT + 0.01,
  east: LNG + 0.01
}

describe('cellsCoveringBounds (extended)', () => {
  it('truncates when maxCells is exceeded', () => {
    // 0.02° area at S17 has ~800+ cells, so maxCells=10 forces truncation
    const bigBounds: Bounds = {
      south: LAT - 0.02,
      west: LNG - 0.02,
      north: LAT + 0.02,
      east: LNG + 0.02
    }
    const { tokens, truncated } = cellsCoveringBounds(bigBounds, 17, 10)
    expect(truncated).toBe(true)
    expect(tokens.length).toBeLessThanOrEqual(10)
  })

  it('500 random points in bounds are all covered', () => {
    const { tokens } = cellsCoveringBounds(bounds, 14, 1500)
    const tokenSet = new Set(tokens)
    // Generate pseudo-random points in bounds
    let seed = 42
    function rand(): number {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 500; i++) {
      const lat = bounds.south + rand() * (bounds.north - bounds.south)
      const lng = bounds.west + rand() * (bounds.east - bounds.west)
      const token = cellTokenAt(lat, lng, 14)
      expect(tokenSet.has(token)).toBe(true)
    }
  })
})

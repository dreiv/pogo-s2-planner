import { describe, it, expect } from 'vitest'
import {
  cellTokenAt,
  cellLevel,
  cellsCoveringBounds,
  type Bounds
} from '../s2'

// Bucharest area (~44.4°N, 26.1°E)
const LAT = 44.4268
const LNG = 26.1025

const bounds: Bounds = {
  south: LAT - 0.01,
  west: LNG - 0.01,
  north: LAT + 0.01,
  east: LNG + 0.01
}

describe('cellsCoveringBounds', () => {
  it('covers S14 cells for a small area', () => {
    const { tokens, truncated } = cellsCoveringBounds(bounds, 14, 1500)
    expect(tokens.length).toBeGreaterThan(0)
    expect(truncated).toBe(false)
    for (const t of tokens) {
      expect(cellLevel(t)).toBe(14)
    }
  })

  it('covers S17 cells for a small area', () => {
    const { tokens, truncated } = cellsCoveringBounds(bounds, 17, 1500)
    expect(tokens.length).toBeGreaterThan(0)
    expect(truncated).toBe(false)
    for (const t of tokens) {
      expect(cellLevel(t)).toBe(17)
    }
  })

  it('input point is inside one of the covering cells', () => {
    const { tokens } = cellsCoveringBounds(bounds, 14, 1500)
    const inputToken = cellTokenAt(LAT, LNG, 14)
    expect(tokens).toContain(inputToken)
  })
})

import { describe, it, expect } from 'vitest'
import {
  cellTokenAt,
  cellVertices,
  cellCenter,
  parentToken,
  childTokens,
  allDescendantTokens,
  cellLevel
} from '../s2'

// Bucharest area (~44.4°N, 26.1°E)
const LAT = 44.4268
const LNG = 26.1025

describe('cellTokenAt', () => {
  it('returns a valid hex token for S14', () => {
    const token = cellTokenAt(LAT, LNG, 14)
    expect(token).toMatch(/^[0-9a-f]+$/)
    expect(cellLevel(token)).toBe(14)
  })

  it('returns a valid hex token for S17', () => {
    const token = cellTokenAt(LAT, LNG, 17)
    expect(token).toMatch(/^[0-9a-f]+$/)
    expect(cellLevel(token)).toBe(17)
  })

  it('is deterministic', () => {
    const a = cellTokenAt(LAT, LNG, 14)
    const b = cellTokenAt(LAT, LNG, 14)
    expect(a).toBe(b)
  })

  it('different points give different cells (usually)', () => {
    const a = cellTokenAt(LAT, LNG, 14)
    const b = cellTokenAt(LAT + 0.01, LNG + 0.01, 14)
    // ~1km apart, likely different S14 cells
    expect(a).not.toBe(b)
  })
})

describe('parentToken', () => {
  it('S17 parent at level 14 matches cellTokenAt', () => {
    const s17 = cellTokenAt(LAT, LNG, 17)
    const s14 = cellTokenAt(LAT, LNG, 14)
    expect(parentToken(s17, 14)).toBe(s14)
  })

  it('S14 parent at level 13 is a valid token', () => {
    const s14 = cellTokenAt(LAT, LNG, 14)
    const s13 = parentToken(s14, 13)
    expect(cellLevel(s13)).toBe(13)
  })
})

describe('childTokens', () => {
  it('S14 has 4 immediate children (S15)', () => {
    const s14 = cellTokenAt(LAT, LNG, 14)
    const children = childTokens(s14)
    expect(children).toHaveLength(4)
    for (const c of children) {
      expect(cellLevel(c)).toBe(15)
    }
  })

  it('allDescendantTokens S14 → S17 gives 64 tokens', () => {
    const s14 = cellTokenAt(LAT, LNG, 14)
    const s17s = allDescendantTokens(s14, 17)
    expect(s17s).toHaveLength(64)
    for (const t of s17s) {
      expect(cellLevel(t)).toBe(17)
    }
  })

  it('allDescendantTokens S14 → S15 gives 4 tokens', () => {
    const s14 = cellTokenAt(LAT, LNG, 14)
    const s15s = allDescendantTokens(s14, 15)
    expect(s15s).toHaveLength(4)
  })
})

describe('cellCenter', () => {
  it('center is near the input point', () => {
    const token = cellTokenAt(LAT, LNG, 14)
    const [cLat, cLng] = cellCenter(token)
    // S14 is ~600m, so center should be within ~0.01° of input
    expect(Math.abs(cLat - LAT)).toBeLessThan(0.01)
    expect(Math.abs(cLng - LNG)).toBeLessThan(0.01)
  })
})

describe('cellVertices', () => {
  it('returns 4 vertices', () => {
    const token = cellTokenAt(LAT, LNG, 14)
    const verts = cellVertices(token)
    expect(verts).toHaveLength(4)
    for (const [lat, lng] of verts) {
      expect(lat).toBeGreaterThan(-90)
      expect(lat).toBeLessThan(90)
      expect(lng).toBeGreaterThan(-180)
      expect(lng).toBeLessThan(180)
    }
  })

  it('S14 side length is between 400 and 800 m at ~44°N', () => {
    const token = cellTokenAt(LAT, LNG, 14)
    const verts = cellVertices(token)
    const v0 = verts[0]!
    const v1 = verts[1]!
    const side = haversine(v0, v1)
    expect(side).toBeGreaterThan(400)
    expect(side).toBeLessThan(800)
  })

  it('S17 side length is between 50 and 100 m at ~44°N', () => {
    const token = cellTokenAt(LAT, LNG, 17)
    const verts = cellVertices(token)
    const v0 = verts[0]!
    const v1 = verts[1]!
    const side = haversine(v0, v1)
    expect(side).toBeGreaterThan(50)
    expect(side).toBeLessThan(100)
  })
})

// Haversine distance in meters
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

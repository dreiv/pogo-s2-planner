import { describe, it, expect } from 'vitest'
import {
  shouldShowGrid,
  clampCellCount,
  estimateCellCount,
  averageCellAreaKm2
} from '../grid-gating'

describe('shouldShowGrid', () => {
  it('visible when zoom >= minZoom', () => {
    const result = shouldShowGrid({ zoom: 14, minZoom: 12, maxCells: 1500 })
    expect(result.visible).toBe(true)
    expect(result.hint).toBeNull()
  })

  it('not visible when zoom < minZoom', () => {
    const result = shouldShowGrid({ zoom: 10, minZoom: 12, maxCells: 1500 })
    expect(result.visible).toBe(false)
    expect(result.hint).toContain('12')
  })

  it('visible at exactly minZoom', () => {
    const result = shouldShowGrid({ zoom: 12, minZoom: 12, maxCells: 1500 })
    expect(result.visible).toBe(true)
  })

  it('S17 default: minZoom 16', () => {
    expect(shouldShowGrid({ zoom: 15, minZoom: 16, maxCells: 1500 }).visible).toBe(false)
    expect(shouldShowGrid({ zoom: 16, minZoom: 16, maxCells: 1500 }).visible).toBe(true)
  })
})

describe('clampCellCount', () => {
  it('returns requested when under max', () => {
    expect(clampCellCount(100, 1500)).toEqual({ count: 100, capped: false })
  })

  it('caps at max when over', () => {
    expect(clampCellCount(2000, 1500)).toEqual({ count: 1500, capped: true })
  })

  it('exact max is not capped', () => {
    expect(clampCellCount(1500, 1500)).toEqual({ count: 1500, capped: false })
  })
})

describe('estimateCellCount / pre-covering gate', () => {
  // 1920x1080 screen at z16 near 45.7N (1.67 m/px): ~0.0162 deg lat x 0.0411 deg lng.
  const z16View = { south: 45.7, north: 45.7162, west: 21.2, east: 21.2411 }
  // z13 view is 8x wider and taller.
  const z13View = { south: 45.7, north: 45.8296, west: 21.2, east: 21.5288 }

  it('average cell area follows 6 * 4^level', () => {
    expect(averageCellAreaKm2(14)).toBeLessThan(0.33)
    expect(averageCellAreaKm2(14)).toBeGreaterThan(0.3)
    expect(averageCellAreaKm2(17)).toBeLessThan(0.005)
    expect(averageCellAreaKm2(17)).toBeGreaterThan(0.0049)
  })

  it('estimates are in the right order of magnitude for real viewports', () => {
    const s17 = estimateCellCount(z16View, 17)
    expect(s17).toBeGreaterThan(1200)
    expect(s17).toBeLessThan(2200)
    const s14 = estimateCellCount(z13View, 14)
    expect(s14).toBeGreaterThan(1200)
    expect(s14).toBeLessThan(2200)
  })

  it('a world-sized view hides the grid with an explanatory hint, without covering', () => {
    const r = shouldShowGrid({
      zoom: 16,
      minZoom: 16,
      maxCells: 1500,
      level: 17,
      bounds: { south: 40, north: 50, west: 10, east: 30 }
    })
    expect(r.visible).toBe(false)
    expect(r.hint).toContain('Too many cells')
  })

  it('a normal view stays visible', () => {
    const r = shouldShowGrid({ zoom: 16, minZoom: 16, maxCells: 2500, level: 17, bounds: z16View })
    expect(r.visible).toBe(true)
  })

  it('borderline views (<= 1.5x the cap) are left to the exact covering', () => {
    const r = shouldShowGrid({ zoom: 16, minZoom: 16, maxCells: 1500, level: 17, bounds: z16View })
    expect(r.visible).toBe(true)
  })

  it('without bounds the old behaviour is unchanged', () => {
    expect(shouldShowGrid({ zoom: 16, minZoom: 16, maxCells: 1, level: 17 }).visible).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { shouldShowGrid, clampCellCount } from '../grid-gating'

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

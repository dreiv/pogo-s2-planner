import { describe, it, expect } from 'vitest'
import { CELL_STATE_TITLES, OCCUPANCY_TEXT, cellStateExplanation } from '../cellStateText'
import { CELL_STATE_COLORS, POI_COLORS } from '../theme'
import type { CellState } from '../core/classify'

const STATES: CellState[] = ['occupied', 'free', 'free-uncertain', 'unknown']

describe('cellStateText', () => {
  it('has a title, a one-liner and an explanation for every state', () => {
    for (const s of STATES) {
      expect(CELL_STATE_TITLES[s].length).toBeGreaterThan(0)
      expect(OCCUPANCY_TEXT[s].length).toBeGreaterThan(0)
      expect(cellStateExplanation(s).length).toBeGreaterThan(0)
    }
  })

  it('explains an incomplete S14 with its POI count when known', () => {
    expect(cellStateExplanation('free-uncertain', 53)).toContain('53 POIs')
    expect(cellStateExplanation('free-uncertain')).toContain('50+')
  })

  it('says that "no data" is not the same as free', () => {
    expect(cellStateExplanation('unknown')).toMatch(/not necessarily free/)
  })
})

describe('theme: no color means two things', () => {
  it('the uncertain and no-data fills never reuse a POI dot color (amber is Power Spot only)', () => {
    const poi = new Set<string>(Object.values(POI_COLORS))
    expect(poi.has(CELL_STATE_COLORS['free-uncertain'])).toBe(false)
    expect(poi.has(CELL_STATE_COLORS.unknown)).toBe(false)
    expect(CELL_STATE_COLORS.free).not.toBe(POI_COLORS.powerspot)
  })

  it('the four cell states are visually distinct', () => {
    expect(new Set(STATES.map((s) => CELL_STATE_COLORS[s])).size).toBe(STATES.length)
  })
})

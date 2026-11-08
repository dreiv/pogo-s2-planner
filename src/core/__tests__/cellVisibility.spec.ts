import { describe, it, expect } from 'vitest'
import { CELL_STATE_FLAG, isCellStateVisible, type CellVisibility } from '../cellVisibility'
import type { CellState } from '../classify'

const ALL: CellState[] = ['occupied', 'free', 'free-uncertain', 'unknown']

function vis(over: Partial<CellVisibility> = {}): CellVisibility {
  return {
    showCellOccupied: true,
    showCellUncertain: true,
    showCellFree: true,
    showCellUnknown: true,
    ...over
  }
}

describe('isCellStateVisible', () => {
  it('maps each state to its own flag', () => {
    expect(isCellStateVisible('occupied', vis({ showCellOccupied: false }))).toBe(false)
    expect(isCellStateVisible('free', vis({ showCellFree: false }))).toBe(false)
    expect(isCellStateVisible('free-uncertain', vis({ showCellUncertain: false }))).toBe(false)
    expect(isCellStateVisible('unknown', vis({ showCellUnknown: false }))).toBe(false)
  })

  it('turning one state off leaves the others visible', () => {
    for (const off of ALL) {
      const v = vis({ [CELL_STATE_FLAG[off]]: false })
      for (const s of ALL) expect(isCellStateVisible(s, v)).toBe(s !== off)
    }
  })

  it('uses a distinct flag per state', () => {
    expect(new Set(ALL.map((s) => CELL_STATE_FLAG[s])).size).toBe(ALL.length)
  })
})

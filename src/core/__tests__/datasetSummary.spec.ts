import { describe, it, expect } from 'vitest'
import { formatSnapshotDate, summarizeDataset } from '../datasetSummary'
import type { ParsedCell, ParsedPoi } from '../wayfarer/parse'

function cell(token: string, truncated: boolean, snapshot: number | null): ParsedCell {
  return { token, count: truncated ? 50 : 3, truncated, generatedTimestamp: null, snapshot, level: 14 }
}

const poi = (id: string): ParsedPoi => ({
  id,
  lat: 0,
  lng: 0,
  title: id,
  description: '',
  address: '',
  imageUrl: '',
  communityContributed: false,
  game: [],
  cellToken: ''
})

describe('summarizeDataset', () => {
  it('is all zeros for an empty dataset', () => {
    expect(summarizeDataset([], [])).toEqual({
      poiCount: 0,
      cellCount: 0,
      incompleteCellCount: 0,
      latestSnapshot: null
    })
  })

  it('counts POIs, cells and incomplete cells, and picks the newest snapshot', () => {
    const s = summarizeDataset(
      [poi('a'), poi('b'), poi('c')],
      [cell('x', false, 1000), cell('y', true, 3000), cell('z', true, null)]
    )
    expect(s.poiCount).toBe(3)
    expect(s.cellCount).toBe(3)
    expect(s.incompleteCellCount).toBe(2)
    expect(s.latestSnapshot).toBe(3000)
  })
})

describe('formatSnapshotDate', () => {
  it('formats as YYYY-MM-DD (UTC)', () => {
    expect(formatSnapshotDate(1794009600000)).toBe('2026-11-07')
  })
  it('returns null for missing or invalid values', () => {
    expect(formatSnapshotDate(null)).toBeNull()
    expect(formatSnapshotDate(NaN)).toBeNull()
  })
})

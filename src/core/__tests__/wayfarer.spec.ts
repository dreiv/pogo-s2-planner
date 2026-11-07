import { describe, it, expect } from 'vitest'
import { parseWayfarer, type ParsedPoi, type ParsedCell } from '../wayfarer/parse'
import { mergeImports } from '../wayfarer/merge'
import sample from '../../../fixtures/wayfarer-sample.json'

// --- Parser tests ---

describe('parseWayfarer', () => {
  it('parses full response format', () => {
    const result = parseWayfarer(sample)
    expect(result.cells).toHaveLength(2)
    expect(result.pois).toHaveLength(12)
    expect(result.warnings).toHaveLength(0)
  })

  it('parses just the result object', () => {
    const result = parseWayfarer(sample.result)
    expect(result.cells).toHaveLength(2)
    expect(result.pois).toHaveLength(12)
  })

  it('parses bare array of cells', () => {
    const result = parseWayfarer(sample.result.data)
    expect(result.cells).toHaveLength(2)
    expect(result.pois).toHaveLength(12)
  })

  it('extracts cell metadata correctly', () => {
    const result = parseWayfarer(sample)
    const c0 = result.cells[0]!
    expect(c0.token).toBe('47456785')
    expect(c0.count).toBe(12)
    expect(c0.truncated).toBe(false)
    expect(c0.level).toBe(14)

    const c1 = result.cells[1]!
    expect(c1.token).toBe('4745678d')
    expect(c1.count).toBe(50)
    expect(c1.truncated).toBe(true)
  })

  it('converts latE6/lngE6 to degrees', () => {
    const result = parseWayfarer(sample)
    const poi = result.pois[0]!
    expect(poi.lat).toBeCloseTo(44.4268, 4)
    expect(poi.lng).toBeCloseTo(26.1025, 4)
  })

  it('assigns cellToken to each POI', () => {
    const result = parseWayfarer(sample)
    for (const poi of result.pois) {
      expect(['47456785', '4745678d']).toContain(poi.cellToken)
    }
  })

  it('preserves multiple gmo entries', () => {
    const result = parseWayfarer(sample)
    const multi = result.pois.find((p) => p.id === 'poi-006')
    expect(multi).toBeDefined()
    expect(multi!.game).toHaveLength(2)
    expect(multi!.game[0]!.entity).toBe('POKESTOP')
    expect(multi!.game[1]!.entity).toBe('GYM')
  })

  it('handles empty gmo array', () => {
    const result = parseWayfarer(sample)
    const noGmo = result.pois.find((p) => p.id === 'poi-004')
    expect(noGmo).toBeDefined()
    expect(noGmo!.game).toHaveLength(0)
  })

  it('handles missing optional fields gracefully', () => {
    const input = {
      result: {
        data: [
          {
            metadata: { s2CellId: 'abc123', count: 1 },
            pois: [{ poiId: 'test-1', latE6: 44000000, lngE6: 26000000 }]
          }
        ]
      }
    }
    const result = parseWayfarer(input)
    expect(result.pois).toHaveLength(1)
    const poi = result.pois[0]!
    expect(poi.title).toBe('')
    expect(poi.description).toBe('')
    expect(poi.imageUrl).toBe('')
    expect(poi.communityContributed).toBe(false)
  })

  it('warns on POI without coordinates', () => {
    const input = {
      result: {
        data: [
          {
            metadata: { s2CellId: 'abc123', count: 1 },
            pois: [{ poiId: 'no-coords' }, { poiId: 'ok', latE6: 44000000, lngE6: 26000000 }]
          }
        ]
      }
    }
    const result = parseWayfarer(input)
    expect(result.pois).toHaveLength(1)
    expect(result.pois[0]!.id).toBe('ok')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('warns on unrecognized format', () => {
    const result = parseWayfarer('not a valid input')
    expect(result.cells).toHaveLength(0)
    expect(result.pois).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('handles null input', () => {
    const result = parseWayfarer(null)
    expect(result.cells).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

// --- Merge tests ---

describe('mergeImports', () => {
  const base = parseWayfarer(sample)
  const basePoi0: ParsedPoi = base.pois[0]!
  const baseCell0: ParsedCell = base.cells[0]!

  it('merges two imports without duplicating POIs', () => {
    const merged = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 1000 },
      { cells: base.cells, pois: base.pois, importTimestamp: 2000 }
    )
    expect(merged.pois).toHaveLength(12)
    expect(merged.cells).toHaveLength(2)
  })

  it('is idempotent — same import twice gives same result', () => {
    const a = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 1000 },
      { cells: base.cells, pois: base.pois, importTimestamp: 2000 }
    )
    const b = mergeImports(
      { cells: a.cells, pois: a.pois, importTimestamp: 2000 },
      { cells: base.cells, pois: base.pois, importTimestamp: 2000 }
    )
    expect(b.pois).toHaveLength(12)
    expect(b.cells).toHaveLength(2)
  })

  it('newer import wins on conflict', () => {
    const newerPoi: ParsedPoi = { ...basePoi0, title: 'Updated Title' }
    const merged = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 1000 },
      { cells: base.cells, pois: [newerPoi], importTimestamp: 2000 }
    )
    const found = merged.pois.find((p) => p.id === 'poi-001')
    expect(found?.title).toBe('Updated Title')
  })

  it('older import does not overwrite newer data', () => {
    const olderPoi: ParsedPoi = { ...basePoi0, title: 'Old Title' }
    const merged = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 2000 },
      { cells: base.cells, pois: [olderPoi], importTimestamp: 1000 }
    )
    const found = merged.pois.find((p) => p.id === 'poi-001')
    expect(found?.title).toBe('Stop Alpha')
  })

  it('merges cells by token, newer wins', () => {
    const updatedCell: ParsedCell = { ...baseCell0, count: 99 }
    const merged = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 1000 },
      { cells: [updatedCell], pois: [], importTimestamp: 2000 }
    )
    const cell = merged.cells.find((c) => c.token === '47456785')
    expect(cell?.count).toBe(99)
  })

  it('unions cells from different imports', () => {
    const extraCell: ParsedCell = {
      token: '99999999',
      count: 5,
      truncated: false,
      generatedTimestamp: null,
      snapshot: null,
      level: 14
    }
    const merged = mergeImports(
      { cells: base.cells, pois: base.pois, importTimestamp: 1000 },
      { cells: [extraCell], pois: [], importTimestamp: 2000 }
    )
    expect(merged.cells).toHaveLength(3)
  })
})

/**
 * Equivalence tests: classifyS17 with and without a pre-computed PoiIndex.
 * These run ALWAYS (not gated by BENCH).
 */
import { describe, it, expect } from 'vitest'
import { classifyS17, DEFAULT_CLASSIFY_OPTS } from '../classify'
import { buildPoiIndex } from '../poiIndex'
import { makeSyntheticDataset } from './helpers/synthetic'
import { cellTokenAt, parentToken } from '../s2'

function mapToArray(m: Map<string, unknown>): [string, unknown][] {
  return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
}

describe('PoiIndex equivalence', () => {
  it('classifyS17 with index ≡ without index (synthetic 1000)', () => {
    const { cells, pois } = makeSyntheticDataset(1000)
    const covered = new Set(cells.map((c) => c.token))
    const truncated = new Set(cells.filter((c) => c.truncated).map((c) => c.token))
    const opts = { ...DEFAULT_CLASSIFY_OPTS }

    const noIndex = classifyS17(pois, covered, truncated, opts)
    const index = buildPoiIndex(pois)
    const withIndex = classifyS17(pois, covered, truncated, opts, index)

    expect(mapToArray(withIndex)).toEqual(mapToArray(noIndex))
  })

  it('index S14 grouping matches poi.cellToken parent (synthetic 1000)', () => {
    const { pois } = makeSyntheticDataset(1000)
    const index = buildPoiIndex(pois)

    for (const poi of pois) {
      const s14FromIndex = parentToken(cellTokenAt(poi.lat, poi.lng, 17), 14)
      // The index groups by computed S14; verify it matches the POI's own cellToken parent
      const s14FromPoi = parentToken(poi.cellToken, 14)
      expect(s14FromIndex).toBe(s14FromPoi)
      // Verify the POI is in the correct S14 bucket
      const bucket = index.poisByS14.get(s14FromPoi)
      expect(bucket).toBeDefined()
      expect(bucket!.some((p) => p.id === poi.id)).toBe(true)
    }
  })

  it('index S17 grouping is consistent (synthetic 1000)', () => {
    const { pois } = makeSyntheticDataset(1000)
    const index = buildPoiIndex(pois)

    // Every POI should appear in exactly one S17 bucket
    let total = 0
    for (const arr of index.poisByS17.values()) {
      total += arr.length
    }
    expect(total).toBe(pois.length)
  })
})

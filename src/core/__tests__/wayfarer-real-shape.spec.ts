import { describe, it, expect } from 'vitest'
import { parseWayfarer } from '../wayfarer/parse'
import real from '../../../fixtures/wayfarer-real-shape.json'

// The fixture is SYNTHETIC but has the exact shape of a real Wayfarer response:
// cells without metadata, string timestamps, result-level snapshot, gameBrand, mainImage.

describe('parseWayfarer — real response shape', () => {
  const r = parseWayfarer(real)

  it('registers cells that have no metadata (empty cells) from top-level cellId', () => {
    const tokens = r.cells.map((c) => c.token)
    expect(tokens).toContain('47455cd9')
    expect(tokens).toContain('47455cdf')
    const empty = r.cells.find((c) => c.token === '47455cd9')
    expect(empty?.count).toBe(0)
    expect(empty?.truncated).toBe(false)
    expect(r.cells).toHaveLength(4)
  })

  it('reads the brand from gmo[].gameBrand', () => {
    const stop = r.pois.find((p) => p.id === 'synthetic-0001.16')
    expect(stop?.game[0]).toEqual({ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' })
  })

  it('reads the image from mainImage and keeps empty string when absent', () => {
    const stop = r.pois.find((p) => p.id === 'synthetic-0001.16')
    expect(stop?.imageUrl).toBe(
      'https://lh3.googleusercontent.com/SYNTHETICIMAGEID0000000000000000000001'
    )
    expect(r.pois.find((p) => p.id === 'synthetic-0003.23')?.imageUrl).toBe('')
  })

  it('converts string generatedTimestamp to a number', () => {
    const c = r.cells.find((x) => x.token === '47455d01')
    expect(c?.generatedTimestamp).toBe(1793975396402)
    expect(c?.level).toBe(14)
    expect(c?.count).toBe(5)
  })

  it('takes snapshot from result.snapshot (date string) for every cell', () => {
    const expected = Date.parse('2026-11-06')
    for (const c of r.cells) expect(c.snapshot).toBe(expected)
  })

  it('assigns cellToken from the parent cell and divides E6 coordinates', () => {
    const gym = r.pois.find((p) => p.id === 'synthetic-0002.16')
    expect(gym?.cellToken).toBe('47455d01')
    expect(gym?.lat).toBeCloseTo(45.723847, 6)
    expect(gym?.lng).toBeCloseTo(21.199125, 6)
  })

  it('skips a POI without coordinates with a warning, does not throw', () => {
    expect(r.pois.find((p) => p.id === 'synthetic-0006.23')).toBeUndefined()
    expect(r.warnings.some((w) => w.includes('synthetic-0006.23'))).toBe(true)
    expect(r.pois).toHaveLength(5)
  })
})

describe('parseWayfarer — wrappers and legacy names', () => {
  it('accepts {result:{data}}, {data} and a bare array', () => {
    const cells = [{ cellId: 'abcd1234', pois: [] }]
    expect(parseWayfarer({ result: { data: cells } }).cells).toHaveLength(1)
    expect(parseWayfarer({ data: cells }).cells).toHaveLength(1)
    expect(parseWayfarer(cells).cells).toHaveLength(1)
  })

  it('returns a warning (no throw) for garbage input', () => {
    for (const bad of [null, 42, 'x', {}, { result: {} }]) {
      const r = parseWayfarer(bad)
      expect(r.cells).toHaveLength(0)
      expect(r.warnings.length).toBeGreaterThan(0)
    }
  })

  it('still accepts the legacy field names (brand, imageUrl, numeric timestamps)', () => {
    const r = parseWayfarer([
      {
        metadata: {
          s2CellId: '47456785',
          count: 1,
          generatedTimestamp: 1700000000,
          snapshot: 1700000000
        },
        pois: [
          {
            poiId: 'legacy-1',
            latE6: 44426800,
            lngE6: 26102500,
            imageUrl: 'https://example.com/x.png',
            gmo: [{ entity: 'GYM', status: 'ACTIVE', brand: 'HOLOHOLO' }]
          }
        ]
      }
    ])
    expect(r.pois[0]!.imageUrl).toBe('https://example.com/x.png')
    expect(r.pois[0]!.game[0]!.brand).toBe('HOLOHOLO')
    expect(r.cells[0]!.generatedTimestamp).toBe(1700000000)
  })

  it('marks cells with count >= 50 as truncated', () => {
    const r = parseWayfarer([{ metadata: { s2CellId: 'aaaa0001', count: 50 }, pois: [] }])
    expect(r.cells[0]!.truncated).toBe(true)
  })
})

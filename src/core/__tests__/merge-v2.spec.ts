import { describe, it, expect } from 'vitest'
import type { ParsedCell, ParsedPoi } from '../wayfarer/parse'
import { mergeImports, mergeMany, type MergeInput } from '../wayfarer/merge'

function cell(token: string, over: Partial<ParsedCell> = {}): ParsedCell {
  return {
    token,
    count: 0,
    truncated: false,
    generatedTimestamp: null,
    snapshot: null,
    level: 14,
    ...over
  }
}

function poi(id: string, cellToken: string, over: Partial<ParsedPoi> = {}): ParsedPoi {
  return {
    id,
    lat: 45.7,
    lng: 21.2,
    title: id,
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: [],
    cellToken,
    ...over
  }
}

function input(cells: ParsedCell[], pois: ParsedPoi[], ts = 1): MergeInput {
  return { cells, pois, importTimestamp: ts }
}

const EMPTY = input([], [])

describe('mergeImports v2', () => {
  it('is idempotent: same import twice = same result', () => {
    const a = input([cell('c1', { count: 2 })], [poi('p1', 'c1'), poi('p2', 'c1')])
    const once = mergeImports(EMPTY, a)
    const twice = mergeImports(input(once.cells, once.pois), a)
    expect(twice.cells).toEqual(once.cells)
    expect(twice.pois).toEqual(once.pois)
    expect(twice.stats.poisUnchanged).toBe(2)
    expect(twice.stats.poisAdded).toBe(0)
  })

  it('applies incoming data even when timestamps are unknown (null) — last import wins', () => {
    const old = input([cell('c1', { count: 1 })], [poi('p1', 'c1', { title: 'old' })], 100)
    const next = input([cell('c1', { count: 1 })], [poi('p1', 'c1', { title: 'new' })], 1) // smaller importTimestamp on purpose
    const r = mergeImports(old, next)
    expect(r.pois[0]!.title).toBe('new')
    expect(r.stats.poisUpdated).toBe(1)
  })

  it('registers coverage from cells even when no POI changes (empty cells = free)', () => {
    const base = input([cell('c1')], [])
    const r = mergeImports(base, input([cell('c2'), cell('c3')], []))
    expect(r.cells.map((c) => c.token)).toEqual(['c1', 'c2', 'c3'])
    expect(r.stats.cellsAdded).toBe(2)
  })

  it('removes POIs that vanished from an incoming non-truncated cell', () => {
    const base = input([cell('c1', { count: 2 })], [poi('p1', 'c1'), poi('p2', 'c1')])
    const r = mergeImports(base, input([cell('c1', { count: 1 })], [poi('p1', 'c1')]))
    expect(r.pois.map((p) => p.id)).toEqual(['p1'])
    expect(r.stats.poisRemoved).toBe(1)
  })

  it('an incoming EMPTY cell clears the POIs of that cell', () => {
    const base = input([cell('c1', { count: 1 })], [poi('p1', 'c1')])
    const r = mergeImports(base, input([cell('c1')], []))
    expect(r.pois).toHaveLength(0)
  })

  it('keeps the union when the incoming cell is truncated (count >= 50)', () => {
    const base = input([cell('c1', { count: 2 })], [poi('p1', 'c1'), poi('p2', 'c1')])
    const r = mergeImports(
      base,
      input(
        [cell('c1', { count: 50, truncated: true })],
        [poi('p1', 'c1', { title: 'upd' }), poi('p3', 'c1')]
      )
    )
    expect(r.pois.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(r.pois[0]!.title).toBe('upd')
  })

  it('ignores an incoming cell that is strictly older than the stored one', () => {
    const base = input(
      [cell('c1', { generatedTimestamp: 2000, count: 1 })],
      [poi('p1', 'c1', { title: 'newer' })]
    )
    const r = mergeImports(
      base,
      input(
        [cell('c1', { generatedTimestamp: 1000, count: 1 })],
        [poi('p1', 'c1', { title: 'older' })]
      )
    )
    expect(r.pois[0]!.title).toBe('newer')
    expect(r.stats.cellsSkippedOlder).toBe(1)
  })

  it('does not delete a POI that moved to another incoming cell', () => {
    const base = input([cell('a', { count: 1 }), cell('b')], [poi('p1', 'a')])
    const r = mergeImports(base, input([cell('a'), cell('b', { count: 1 })], [poi('p1', 'b')]))
    expect(r.pois).toHaveLength(1)
    expect(r.pois[0]!.cellToken).toBe('b')
  })

  it('does not touch cells that are not in the incoming import', () => {
    const base = input(
      [cell('a', { count: 1 }), cell('z', { count: 1 })],
      [poi('pa', 'a'), poi('pz', 'z')]
    )
    const r = mergeImports(base, input([cell('a', { count: 1 })], [poi('pa', 'a', { title: 'x' })]))
    expect(r.pois.find((p) => p.id === 'pz')).toBeDefined()
    expect(r.cells.map((c) => c.token)).toEqual(['a', 'z'])
  })

  it('does not mutate its inputs', () => {
    const base = input([cell('c1', { count: 1 })], [poi('p1', 'c1')])
    const snapshot = JSON.stringify(base)
    mergeImports(base, input([cell('c1')], []))
    expect(JSON.stringify(base)).toBe(snapshot)
  })
})

describe('mergeMany', () => {
  it('folds several imports in order and sums stats', () => {
    const d1 = input([cell('c1', { count: 1 })], [poi('p1', 'c1')])
    const d2 = input([cell('c2', { count: 1 })], [poi('p2', 'c2')])
    const r = mergeMany(EMPTY, [d1, d2])
    expect(r.pois.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(r.cells).toHaveLength(2)
    expect(r.stats.poisAdded).toBe(2)
    expect(r.stats.cellsAdded).toBe(2)
  })

  it('later documents win over earlier ones for the same cell', () => {
    const d1 = input([cell('c1', { count: 1 })], [poi('p1', 'c1', { title: 'first' })])
    const d2 = input([cell('c1', { count: 1 })], [poi('p1', 'c1', { title: 'second' })])
    const r = mergeMany(EMPTY, [d1, d2])
    expect(r.pois[0]!.title).toBe('second')
  })
})

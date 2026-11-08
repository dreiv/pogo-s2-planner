import { describe, it, expect } from 'vitest'
import {
  buildCoverage,
  classifyS17Token,
  createCellStateResolver,
  CELL_STATE_CACHE_LIMIT
} from '../cellState'
import { DEFAULT_CLASSIFY_OPTS } from '../classify'
import type { ParsedCell, ParsedPoi } from '../wayfarer/parse'

function poi(id: string, entity: string, status = 'ACTIVE'): ParsedPoi {
  return {
    id,
    lat: 0,
    lng: 0,
    title: id,
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: [{ entity, status, brand: 'HOLOHOLO' }],
    cellToken: ''
  }
}

function cell(token: string, truncated = false): ParsedCell {
  return { token, count: 0, truncated, generatedTimestamp: null, snapshot: null, level: 14 }
}

// Fake S2 parent: the first 4 hex chars stand in for the S14 token.
const parentOf = (t: string): string => t.slice(0, 4)

describe('classifyS17Token', () => {
  const covered = { covered: true, truncated: false }
  it('unknown without coverage', () => {
    expect(classifyS17Token([], { covered: false, truncated: false }, DEFAULT_CLASSIFY_OPTS)).toBe('unknown')
  })
  it('occupied by an active stop or gym', () => {
    expect(classifyS17Token([poi('a', 'POKESTOP')], covered, DEFAULT_CLASSIFY_OPTS)).toBe('occupied')
    expect(classifyS17Token([poi('a', 'GYM')], covered, DEFAULT_CLASSIFY_OPTS)).toBe('occupied')
  })
  it('inactive stops and power spots do not occupy', () => {
    expect(classifyS17Token([poi('a', 'POKESTOP', 'INACTIVE')], covered, DEFAULT_CLASSIFY_OPTS)).toBe('free')
    expect(classifyS17Token([poi('a', 'POWERSPOT')], covered, DEFAULT_CLASSIFY_OPTS)).toBe('free')
  })
  it('free-uncertain in a truncated S14 cell', () => {
    expect(classifyS17Token([], { covered: true, truncated: true }, DEFAULT_CLASSIFY_OPTS)).toBe('free-uncertain')
  })
})

describe('createCellStateResolver', () => {
  const poisByS17 = new Map<string, ParsedPoi[]>([['aaaa0001', [poi('p1', 'POKESTOP')]]])
  const coverage = buildCoverage([cell('aaaa'), cell('bbbb', true)])
  const resolve = createCellStateResolver({ poisByS17, coverage, opts: DEFAULT_CLASSIFY_OPTS, parentOf })

  it('resolves all four states', () => {
    expect(resolve('aaaa0001')).toBe('occupied')
    expect(resolve('aaaa0002')).toBe('free')
    expect(resolve('bbbb0001')).toBe('free-uncertain')
    expect(resolve('cccc0001')).toBe('unknown')
  })

  it('memoizes: the parent lookup runs once per token', () => {
    let calls = 0
    const r = createCellStateResolver({
      poisByS17,
      coverage,
      opts: DEFAULT_CLASSIFY_OPTS,
      parentOf: (t) => {
        calls++
        return parentOf(t)
      }
    })
    r('aaaa0001')
    r('aaaa0001')
    r('aaaa0001')
    expect(calls).toBe(1)
  })

  it('cache is bounded', () => {
    let calls = 0
    const r = createCellStateResolver({
      poisByS17: new Map(),
      coverage,
      opts: DEFAULT_CLASSIFY_OPTS,
      parentOf: (t) => {
        calls++
        return parentOf(t)
      }
    })
    for (let i = 0; i < CELL_STATE_CACHE_LIMIT + 5; i++) r(`aaaa${i}`)
    expect(calls).toBe(CELL_STATE_CACHE_LIMIT + 5)
    r('aaaa0') // evicted by the clear, so it is computed again
    expect(calls).toBe(CELL_STATE_CACHE_LIMIT + 6)
  })
})

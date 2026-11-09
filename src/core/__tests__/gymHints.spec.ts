import { describe, it, expect } from 'vitest'
import {
  DEFAULT_GYM_HINT_OPTIONS,
  GYM_HINT_MIN_COUNT,
  computeGymHints,
  filterGymHints,
  gymHint,
  gymHintDeclutterLimit,
  gymHintLabel,
  gymHintText,
  gymsForCount,
  isHintShown,
  nextGym,
  sortGymHints,
  type GymHintCell
} from '../gymHints'
import type { ParsedPoi } from '../wayfarer/parse'

function poi(id: string, entity: string | null): ParsedPoi {
  return {
    id,
    lat: 45,
    lng: 21,
    title: id,
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: entity ? [{ entity, status: 'ACTIVE', brand: 'HOLOHOLO' }] : [],
    cellToken: 'x'
  }
}

function cellOf(count: number, over: Partial<GymHintCell> = {}): GymHintCell {
  return {
    token: 't',
    lat: 1,
    lng: 2,
    hint: nextGym(count)!,
    reported: count,
    imported: count,
    partial: false,
    ...over
  }
}

describe('gymsForCount', () => {
  it('follows the 2 / 6 / 20 tiers', () => {
    expect([0, 1, 2, 5, 6, 19, 20, 99].map(gymsForCount)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })
})

describe('nextGym', () => {
  it('has no thresholds: even 0 stops are 2 away from the 1st gym', () => {
    expect(nextGym(0)).toEqual({ count: 0, remaining: 2, gymsNow: 0, gymsNext: 1 })
    expect(nextGym(10)).toEqual({ count: 10, remaining: 10, gymsNow: 2, gymsNext: 3 })
  })
  it('is null once every tier is unlocked', () => {
    expect(nextGym(20)).toBeNull()
    expect(nextGym(60)).toBeNull()
  })
})

describe('gymHint (defaults)', () => {
  it('starts at 3 stops: nothing below that', () => {
    expect(GYM_HINT_MIN_COUNT).toBe(3)
    expect([0, 1, 2].map((n) => gymHint(n))).toEqual([null, null, null])
  })

  it('3 stops: 3 more for the 2nd gym; 5 stops: 1 more', () => {
    expect(gymHint(3)).toEqual({ count: 3, remaining: 3, gymsNow: 1, gymsNext: 2 })
    expect(gymHint(5)).toEqual({ count: 5, remaining: 1, gymsNow: 1, gymsNext: 2 })
  })

  it('has no hint right after a gym unlocks, or when nothing is near', () => {
    expect([6, 10, 16].map((n) => gymHint(n))).toEqual([null, null, null])
  })

  it('hints at the 3rd gym from 17 stops, and never past the last tier', () => {
    expect(gymHint(17)).toEqual({ count: 17, remaining: 3, gymsNow: 2, gymsNext: 3 })
    expect(gymHint(19)?.remaining).toBe(1)
    expect(gymHint(20)).toBeNull()
    expect(gymHint(50)).toBeNull()
  })

  it('respects custom thresholds', () => {
    expect(gymHint(1, 1, 3)?.gymsNext).toBe(1)
    expect(gymHint(4, 3, 1)).toBeNull()
  })
})

describe('isHintShown / filterGymHints / sortGymHints', () => {
  it('applies both thresholds', () => {
    const h = nextGym(4)! // 2 more needed
    expect(isHintShown(h, { minCount: 4, maxRemaining: 2 })).toBe(true)
    expect(isHintShown(h, { minCount: 5, maxRemaining: 2 })).toBe(false)
    expect(isHintShown(h, { minCount: 4, maxRemaining: 1 })).toBe(false)
  })

  it('a wider setting shows more cells', () => {
    const cells = [cellOf(3), cellOf(4), cellOf(5), cellOf(10)]
    expect(filterGymHints(cells, DEFAULT_GYM_HINT_OPTIONS)).toHaveLength(3)
    expect(filterGymHints(cells, { minCount: 1, maxRemaining: 5 })).toHaveLength(3)
    expect(filterGymHints(cells, { minCount: 1, maxRemaining: 10 })).toHaveLength(4)
    expect(filterGymHints(cells, { minCount: 5, maxRemaining: 3 })).toHaveLength(1)
  })

  it('sorts the closest cell first, then the fuller one, then by token', () => {
    const a = cellOf(5, { token: 'b' }) // +1
    const b = cellOf(4, { token: 'a' }) // +2
    const c = cellOf(18, { token: 'c' }) // +2, fuller
    const d = cellOf(4, { token: 'z' }) // +2
    expect(sortGymHints([b, d, c, a]).map((x) => x.token)).toEqual(['b', 'c', 'a', 'z'])
  })
})

describe('gymHintDeclutterLimit', () => {
  it('shows only the closest hints when zoomed out', () => {
    expect([12, 13, 13.9].map((z) => gymHintDeclutterLimit(z, 3))).toEqual([1, 1, 1])
    expect(gymHintDeclutterLimit(14, 3)).toBe(2)
    expect([15, 16, 18].map((z) => gymHintDeclutterLimit(z, 3))).toEqual([3, 3, 3])
  })
  it('never exceeds the setting', () => {
    expect(gymHintDeclutterLimit(12, 1)).toBe(1)
    expect(gymHintDeclutterLimit(14, 1)).toBe(1)
    expect(gymHintDeclutterLimit(15, 5)).toBe(5)
  })
})

describe('label and text', () => {
  it('has a readable label', () => {
    expect(gymHintLabel(cellOf(4))).toBe('+2 → 2nd gym')
    expect(gymHintLabel(cellOf(18))).toBe('+2 → 3rd gym')
  })
  it('marks a partial cell with a question mark and says why', () => {
    const partial = cellOf(4, { reported: 9, imported: 6, partial: true })
    expect(gymHintLabel(partial)).toBe('+2? → 2nd gym')
    const text = gymHintText(partial)
    expect(text).toContain('Wayfarer reports 9 POIs here but only 6 were imported')
    expect(gymHintText(cellOf(4))).not.toContain('Wayfarer reports')
  })
  it('the sentence reads right for 1 and for several', () => {
    expect(gymHintText(cellOf(4))).toContain('4 stops and gyms')
    expect(gymHintText(cellOf(4))).toContain('2 more stops')
    expect(gymHintText(cellOf(5))).toContain('1 more stop ')
  })
})

describe('computeGymHints', () => {
  const stops = (n: number) => Array.from({ length: n }, (_, i) => poi(`s${i}`, 'POKESTOP'))
  const centerOf = (): [number, number] => [1, 2]

  it('returns every covered cell short of its last gym, whatever the thresholds', () => {
    const poisByS14 = new Map([
      ['near', stops(4)],
      ['far', stops(10)],
      ['done', stops(25)],
      ['uncovered', stops(5)]
    ])
    const reported = new Map([
      ['near', 4],
      ['far', 10],
      ['done', 25]
    ])
    const res = computeGymHints(poisByS14, reported, centerOf)
    expect(res.map((r) => r.token).sort()).toEqual(['far', 'near'])
    expect(res.find((r) => r.token === 'near')).toMatchObject({
      lat: 1,
      lng: 2,
      hint: { remaining: 2 },
      partial: false
    })
  })

  it('counts only active stops and gyms, not non-game POIs', () => {
    const reported = new Map([['c', 5]])
    const mixed = [...stops(2), poi('o1', null), poi('o2', null), poi('o3', null)]
    const [cell] = computeGymHints(new Map([['c', mixed]]), reported, centerOf)
    expect(cell?.hint.count).toBe(2)
    const withGym = [...stops(2), poi('g', 'GYM')]
    expect(computeGymHints(new Map([['c', withGym]]), reported, centerOf)[0]?.hint.count).toBe(3)
  })

  it('skips cells with no active stop or gym', () => {
    const only = [poi('o1', null)]
    expect(computeGymHints(new Map([['c', only]]), new Map([['c', 1]]), centerOf)).toEqual([])
  })

  it('flags partial data when Wayfarer reports more POIs than were imported', () => {
    const res = computeGymHints(new Map([['c', stops(4)]]), new Map([['c', 7]]), centerOf)
    expect(res[0]).toMatchObject({ reported: 7, imported: 4, partial: true })
    const full = computeGymHints(new Map([['c', stops(4)]]), new Map([['c', 4]]), centerOf)
    expect(full[0]?.partial).toBe(false)
  })
})

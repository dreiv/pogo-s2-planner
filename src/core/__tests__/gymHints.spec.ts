import { describe, it, expect } from 'vitest'
import {
  GYM_HINT_MIN_COUNT,
  computeGymHints,
  gymHint,
  gymHintLabel,
  gymHintText,
  gymsForCount
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

describe('gymsForCount', () => {
  it('follows the 2 / 6 / 20 tiers', () => {
    expect([0, 1, 2, 5, 6, 19, 20, 99].map(gymsForCount)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })
})

describe('gymHint', () => {
  it('starts at 3 stops: nothing below that', () => {
    expect(GYM_HINT_MIN_COUNT).toBe(3)
    expect(gymHint(0)).toBeNull()
    expect(gymHint(1)).toBeNull()
    expect(gymHint(2)).toBeNull()
  })

  it('3 stops: 3 more for the 2nd gym; 5 stops: 1 more', () => {
    expect(gymHint(3)).toEqual({ count: 3, remaining: 3, gymsNow: 1, gymsNext: 2 })
    expect(gymHint(5)).toEqual({ count: 5, remaining: 1, gymsNow: 1, gymsNext: 2 })
  })

  it('has no hint right after a gym unlocks, or when nothing is near', () => {
    expect(gymHint(6)).toBeNull()
    expect(gymHint(10)).toBeNull()
    expect(gymHint(16)).toBeNull()
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

  it('has readable label and text', () => {
    const h = gymHint(4)!
    expect(gymHintLabel(h)).toBe('+2 → 2nd gym')
    expect(gymHintText(h)).toContain('4 stops and gyms')
    expect(gymHintText(h)).toContain('2 more stops')
    expect(gymHintText(gymHint(5)!)).toContain('1 more stop ')
  })
})

describe('computeGymHints', () => {
  const stops = (n: number) => Array.from({ length: n }, (_, i) => poi(`s${i}`, 'POKESTOP'))
  const centerOf = (): [number, number] => [1, 2]

  it('hints only covered cells that are close to a gym', () => {
    const poisByS14 = new Map([
      ['near', stops(4)],
      ['far', stops(10)],
      ['uncovered', stops(5)]
    ])
    const coverage = new Map([
      ['near', false],
      ['far', false]
    ])
    const res = computeGymHints(poisByS14, coverage, centerOf)
    expect(res.map((r) => r.token)).toEqual(['near'])
    expect(res[0]).toMatchObject({ lat: 1, lng: 2, hint: { remaining: 2 } })
  })

  it('counts only active stops and gyms, not non-game POIs', () => {
    const mixed = [...stops(2), poi('o1', null), poi('o2', null), poi('o3', null)]
    expect(computeGymHints(new Map([['c', mixed]]), new Map([['c', false]]), centerOf)).toEqual([])
    const withGym = [...stops(2), poi('g', 'GYM')]
    expect(
      computeGymHints(new Map([['c', withGym]]), new Map([['c', false]]), centerOf)
    ).toHaveLength(1)
  })
})

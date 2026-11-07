import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cellTokenAt } from '../s2'

interface GroundTruthPoint {
  lat: number
  lng: number
  s14: string
}

const FIXTURE_PATH = resolve('fixtures/s2-ground-truth.json')

let points: GroundTruthPoint[] = []
let fixtureExists = false

beforeAll(() => {
  try {
    if (existsSync(FIXTURE_PATH)) {
      fixtureExists = true
      points = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as GroundTruthPoint[]
    }
  } catch {
    fixtureExists = false
  }
})

describe('ground truth (requires fixtures/s2-ground-truth.json)', () => {
  it.skipIf(!fixtureExists)('cellTokenAt matches Wayfarer s2CellId for all points', () => {
    expect(points.length).toBeGreaterThan(0)
    for (const p of points) {
      const token = cellTokenAt(p.lat, p.lng, 14)
      expect(token, `point ${p.lat},${p.lng} expected s14=${p.s14}`).toBe(p.s14)
    }
  })
})

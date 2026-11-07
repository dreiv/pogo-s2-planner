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
const REQUIRE_GROUND_TRUTH = process.env.REQUIRE_GROUND_TRUTH === '1'

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
  // Skip unless the fixture exists OR REQUIRE_GROUND_TRUTH=1 (CI gate).
  const shouldSkip = !fixtureExists && !REQUIRE_GROUND_TRUTH

  it.skipIf(shouldSkip)('cellTokenAt matches Wayfarer s2CellId for all points', () => {
    if (!fixtureExists) {
      throw new Error(
        'fixtures/s2-ground-truth.json not found. ' +
          'Put your Wayfarer export in local-data/wayfarer.json and run: ' +
          'node scripts/make-ground-truth.mjs'
      )
    }
    expect(points.length).toBeGreaterThan(0)
    for (const p of points) {
      const token = cellTokenAt(p.lat, p.lng, 14)
      expect(token, `point ${p.lat},${p.lng} expected s14=${p.s14}`).toBe(p.s14)
    }
  })
})

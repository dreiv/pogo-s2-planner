// Usage: node scripts/make-ground-truth.mjs [local-data/wayfarer.json]
// Reads a real Wayfarer export and writes fixtures/s2-ground-truth.json:
// a few (lat, lng) points per cell + the S14 token given by metadata.s2CellId.
// Only coordinates and tokens are written (no titles/descriptions/images).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const input = process.argv[2] ?? 'local-data/wayfarer.json'
const raw = JSON.parse(readFileSync(input, 'utf8'))
const cells = raw?.result?.data ?? raw?.data ?? raw
if (!Array.isArray(cells)) throw new Error('Unexpected format: expected result.data[]')

const PER_CELL = 5
const points = []
for (const cell of cells) {
  const token = cell?.metadata?.s2CellId || cell?.cellId
  if (!token) continue
  const pois = (cell.pois ?? []).filter((p) => Number.isFinite(p.latE6) && Number.isFinite(p.lngE6))
  // spread picks across the list instead of taking the first N
  const step = Math.max(1, Math.floor(pois.length / PER_CELL))
  for (let i = 0, n = 0; i < pois.length && n < PER_CELL; i += step, n++) {
    points.push({ lat: pois[i].latE6 / 1e6, lng: pois[i].lngE6 / 1e6, s14: token })
  }
}
mkdirSync('fixtures', { recursive: true })
writeFileSync('fixtures/s2-ground-truth.json', JSON.stringify(points, null, 2))
console.log(`Wrote ${points.length} points from ${cells.length} cells`)

// Runs only with BENCH=1: BENCH=1 npx vitest run src/core/__tests__/perf.bench.spec.ts
import { describe, it } from 'vitest'
import { performance } from 'perf_hooks'
import { classifyS17, poiKind } from '../classify'
import { mergeImports, type MergeInput } from '../wayfarer/merge'
import { makeSyntheticDataset } from './helpers/synthetic'

const BENCH = process.env.BENCH === '1'

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

function bench<T>(fn: () => T, runs = 3): { result: T; ms: number } {
  const times: number[] = []
  let result = undefined as T
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    result = fn()
    times.push(performance.now() - t0)
  }
  return { result, ms: median(times) }
}

describe.skipIf(!BENCH)('Performance benchmarks', () => {
  it('benchmarks core operations', () => {
    const sizes = [2000, 10000, 30000]
    const rows: Record<string, string | number>[] = []

    for (const n of sizes) {
      const { cells, pois } = makeSyntheticDataset(n)

      const covered = new Set(cells.map((c) => c.token))
      const truncated = new Set(cells.filter((c) => c.truncated).map((c) => c.token))
      const cls = bench(() => classifyS17(pois, covered, truncated))
      if (cls.result.size === 0) throw new Error('classifyS17 returned empty')

      const emptyInput: MergeInput = { cells: [], pois: [], importTimestamp: 0 }
      const incoming: MergeInput = { cells, pois, importTimestamp: Date.now() }
      const merge1 = bench(() => mergeImports(emptyInput, incoming))
      if (merge1.result.pois.length === 0) throw new Error('mergeImports returned empty')

      const existing: MergeInput = {
        cells: merge1.result.cells,
        pois: merge1.result.pois,
        importTimestamp: Date.now()
      }
      const merge2 = bench(() => mergeImports(existing, incoming))
      if (merge2.result.pois.length === 0) throw new Error('second mergeImports returned empty')

      const kindBench = bench(() => {
        for (const poi of pois) poiKind(poi)
        return pois.length
      })
      if (kindBench.result === 0) throw new Error('poiKind returned 0')

      rows.push({
        N: n,
        'classifyS17 (ms)': cls.ms.toFixed(1),
        'mergeImports empty→full (ms)': merge1.ms.toFixed(1),
        'mergeImports full→full (ms)': merge2.ms.toFixed(1),
        'poiKind all (ms)': kindBench.ms.toFixed(1)
      })
    }

    console.table(rows)
  }, 120_000)
})

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isReactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useDatasetStore } from '../dataset'
import { db } from '../../data/db'
import type { ExportedDataset } from '../../core/backup'

// The real seed is a ~1.5 MB bundled file: tests control it through this mock instead.
const seed = vi.hoisted(() => ({ dataset: null as ExportedDataset | null }))
vi.mock('../../data/initialData', () => ({
  loadInitialDataset: async () => seed.dataset
}))

// Minimal Wayfarer JSON fixture (synthetic)
const sampleJson = {
  result: {
    snapshot: '2026-01-01',
    data: [
      {
        metadata: { s2CellId: '892f3a1b', count: 2 },
        pois: [
          {
            poiId: 'SYNTHETICIMAGEID-001',
            latE6: 45767000,
            lngE6: 21256000,
            title: 'Synthetic Stop A',
            gmo: [{ entity: 'POKESTOP', status: 'ACTIVE', gameBrand: 'HOLOHOLO' }],
            mainImage: 'https://example.com/synthetic-a.jpg',
            isCommunityContributed: false
          },
          {
            poiId: 'SYNTHETICIMAGEID-002',
            latE6: 45768000,
            lngE6: 21257000,
            title: 'Synthetic Gym B',
            gmo: [{ entity: 'GYM', status: 'ACTIVE', gameBrand: 'HOLOHOLO' }],
            mainImage: 'https://example.com/synthetic-b.jpg',
            isCommunityContributed: false
          }
        ]
      },
      {
        cellId: '892f3a1c',
        pois: []
      }
    ]
  }
}

beforeEach(async () => {
  seed.dataset = null
  setActivePinia(createPinia())
  await db.pois.clear()
  await db.cells.clear()
  await db.imports.clear()
})

describe('dataset store', () => {
  it('starts empty', () => {
    const store = useDatasetStore()
    expect(store.pois).toEqual([])
    expect(store.cells).toEqual([])
    expect(store.revision).toBe(0)
  })

  it('importDocuments populates state and increments revision', async () => {
    const store = useDatasetStore()
    const summary = await store.importDocuments([{ name: 'test.json', json: sampleJson }])

    expect(summary.documents).toBe(1)
    expect(summary.poisAdded).toBe(2)
    expect(summary.poiCount).toBe(2)
    expect(summary.stopCount).toBe(1)
    expect(summary.gymCount).toBe(1)
    expect(store.pois.length).toBe(2)
    expect(store.revision).toBe(1)
  })

  it('importDocuments persists to IndexedDB', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])

    const dbPois = await db.pois.toArray()
    const dbCells = await db.cells.toArray()
    expect(dbPois.length).toBe(2)
    expect(dbCells.length).toBeGreaterThanOrEqual(1)
  })

  it('importDocuments replaces data on second import (no ConstraintError)', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'first.json', json: sampleJson }])

    const summary = await store.importDocuments([{ name: 'second.json', json: sampleJson }])
    expect(summary.poisUnchanged).toBe(2)
    expect(store.pois.length).toBe(2)
    expect(store.revision).toBe(2)
  })

  it('importDocuments with multiple docs merges correctly', async () => {
    const store = useDatasetStore()
    const summary = await store.importDocuments([
      { name: 'a.json', json: sampleJson },
      { name: 'b.json', json: sampleJson }
    ])
    expect(summary.documents).toBe(2)
    expect(store.pois.length).toBe(2)
  })

  it('clearAll empties state and DB', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])
    expect(store.pois.length).toBe(2)

    await store.clearAll()
    expect(store.pois).toEqual([])
    expect(store.cells).toEqual([])
    expect(store.imports).toEqual([])
    expect(store.revision).toBe(2)

    const dbPois = await db.pois.toArray()
    expect(dbPois).toEqual([])
  })

  async function makeSeed(): Promise<ExportedDataset> {
    const scratch = useDatasetStore()
    await scratch.importDocuments([{ name: 'test.json', json: sampleJson }])
    const data = { pois: [...scratch.pois], cells: [...scratch.cells] }
    await scratch.clearAll()
    setActivePinia(createPinia())
    return data
  }

  it('does not seed anything when no initial dataset is bundled', async () => {
    const store = useDatasetStore()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(store.pois).toEqual([])
    expect(store.loadError).toBeNull()
    expect(await db.pois.count()).toBe(0)
  })

  it('pre-populates an empty database with the initial dataset on load', async () => {
    seed.dataset = await makeSeed()
    const store = useDatasetStore()
    await store.load()
    expect(store.pois).toHaveLength(2)
    expect(store.cells.length).toBeGreaterThan(0)
    expect(store.imports[0]?.fileName).toBe('initial data')
    expect(await db.pois.count()).toBe(2)
    expect(store.storageError).toBeNull()
  })

  it('brings the initial data back on reload after "Delete all"', async () => {
    seed.dataset = await makeSeed()
    const store = useDatasetStore()
    await store.load()
    await store.clearAll()
    expect(store.pois).toEqual([])

    setActivePinia(createPinia())
    const fresh = useDatasetStore()
    await fresh.load()
    expect(fresh.pois).toHaveLength(2)
  })

  it('never seeds over data that is already stored', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'mine.json', json: sampleJson }])
    seed.dataset = {
      pois: [{ ...store.pois[0]!, id: 'seed-only' }],
      cells: [...store.cells]
    }

    setActivePinia(createPinia())
    const fresh = useDatasetStore()
    await fresh.load()
    expect(fresh.pois.map((p) => p.id)).not.toContain('seed-only')
    expect(fresh.imports[0]?.fileName).toBe('mine.json')
  })

  it('shows the seed from memory only when the database cannot be read', async () => {
    seed.dataset = await makeSeed()
    const store = useDatasetStore()
    const original = db.pois.toArray
    db.pois.toArray = () => Promise.reject(new Error('IndexedDB blocked'))
    try {
      await store.load()
    } finally {
      db.pois.toArray = original
    }
    expect(store.loadError).toContain('IndexedDB blocked')
    expect(store.pois).toHaveLength(2)
    expect(await db.pois.count()).toBe(0)
  })

  it('replaceAll swaps the dataset, persists it and resets import history', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])
    const poi = { ...store.pois[0]!, id: 'restored-1' }
    const cell = { ...store.cells[0]!, token: 'abcd01' }

    await store.replaceAll([poi], [cell], 'backup restore')

    expect(store.pois.map((p) => p.id)).toEqual(['restored-1'])
    expect(store.cells.map((c) => c.token)).toEqual(['abcd01'])
    expect(store.imports).toHaveLength(1)
    expect((await db.pois.toArray()).map((p) => p.id)).toEqual(['restored-1'])
    expect((await db.imports.toArray()).map((i) => i.fileName)).toEqual(['backup restore'])
  })

  it('reports a failed write in storageError but keeps the data in memory', async () => {
    const store = useDatasetStore()
    const original = db.transaction.bind(db)
    ;(db as unknown as { transaction: () => Promise<never> }).transaction = () =>
      Promise.reject(new Error('quota exceeded'))
    try {
      const summary = await store.importDocuments([{ name: 'test.json', json: sampleJson }])
      expect(summary.poisAdded).toBe(2)
      expect(store.pois).toHaveLength(2)
      expect(store.storageError).toContain('quota exceeded')
    } finally {
      ;(db as unknown as { transaction: typeof original }).transaction = original
    }
  })

  it('reports an unreadable database in loadError and still finishes loading', async () => {
    const store = useDatasetStore()
    const spy = db.pois.toArray
    db.pois.toArray = () => Promise.reject(new Error('IndexedDB blocked'))
    try {
      await store.load()
      expect(store.loaded).toBe(true)
      expect(store.loadError).toContain('IndexedDB blocked')
      expect(store.pois).toEqual([])
    } finally {
      db.pois.toArray = spy
    }
  })

  it('shares one POI index / cell-state resolver per revision', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])
    const first = store.poiIndex
    expect(store.poiIndex).toBe(first)
    expect(store.cellStateResolver).toBe(store.cellStateResolver)
    await store.importDocuments([{ name: 'again.json', json: sampleJson }])
    expect(store.poiIndex).not.toBe(first)
  })

  it('load reads from IndexedDB', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])

    // Simulate fresh store (new Pinia)
    setActivePinia(createPinia())
    const freshStore = useDatasetStore()
    expect(freshStore.loaded).toBe(false)

    await freshStore.load()
    expect(freshStore.loaded).toBe(true)
    expect(freshStore.pois.length).toBe(2)
  })

  it('importFromJson wrapper works', async () => {
    const store = useDatasetStore()
    const summary = await store.importFromJson(sampleJson, 'pasted')
    expect(summary.documents).toBe(1)
    expect(store.pois.length).toBe(2)
  })

  it('pois and cells are not deeply reactive (markRaw)', async () => {
    const store = useDatasetStore()
    await store.importDocuments([{ name: 'test.json', json: sampleJson }])

    // The arrays themselves should not be reactive proxies
    expect(isReactive(store.pois)).toBe(false)
    expect(isReactive(store.cells)).toBe(false)
    // Individual items should not be reactive either
    if (store.pois.length > 0) {
      expect(isReactive(store.pois[0])).toBe(false)
    }
  })
})

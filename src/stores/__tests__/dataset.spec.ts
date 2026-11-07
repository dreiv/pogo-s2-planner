/**
 * Dataset store tests — uses fake-indexeddb for IndexedDB polyfill.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { isReactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useDatasetStore } from '../dataset'
import { db } from '../../data/db'

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
  // Fresh Pinia per test
  setActivePinia(createPinia())
  // Clear all tables
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

    // Import again with same data — should not throw
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
    // Same POIs in both docs → deduped
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

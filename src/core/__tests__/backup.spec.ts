import { describe, it, expect } from 'vitest'
import {
  parseBackup,
  buildBackup,
  sanitizeDataset,
  SCHEMA_VERSION,
  type BackupFile,
  type ExportedMark,
  type ExportedSettings,
  type MarkStatus
} from '../backup'
import { defaultSettings } from '../settings'

function makeMark(
  token17: string,
  status: MarkStatus = 'propus',
  note = '',
  updatedAt = 1000
): ExportedMark {
  return { token17, status, note, updatedAt }
}

function makeSettings(): ExportedSettings {
  return {
    center: [45.7, 21.3],
    zoom: 14,
    showS14: true,
    showS17: false,
    showGymHints: true,
    gymHintMinCount: 3,
    gymHintMaxRemaining: 3,
    s14MinZoom: 12,
    s17MinZoom: 16,
    showPois: true,
    showOtherPois: false,
    showGyms: true,
    showStops: false,
    showPowerSpots: true,
    showRange: false,
    rangeRadius: 100,
    rangeCenter: [45.71, 21.31],
    showCellOccupied: true,
    showCellUncertain: false,
    showCellFree: true,
    showCellUnknown: true,
    hiddenMarkStatuses: ['respins']
  }
}

describe('buildBackup', () => {
  it('builds a valid backup file', () => {
    const marks = [makeMark('abc123', 'propus', 'test note')]
    const settings = makeSettings()
    const file = buildBackup(marks, settings)

    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(file.exportedAt).toBeTypeOf('number')
    expect(file.marks).toHaveLength(1)
    expect(file.marks[0]!.token17).toBe('abc123')
    expect(file.settings.showS14).toBe(true)
    expect(file.dataset).toBeUndefined()
  })

  it('includes dataset when provided', () => {
    const dataset = { pois: [{ id: '1' }], cells: [{ token: 'x' }] }
    const file = buildBackup([], makeSettings(), dataset)
    expect(file.dataset).toEqual(dataset)
  })
})

describe('parseBackup', () => {
  it('round-trip: build → parse returns same data', () => {
    const marks = [
      makeMark('token1', 'propus', 'note1'),
      makeMark('token2', 'in-review', 'note2'),
      makeMark('token3', 'aprobat', '')
    ]
    const settings = makeSettings()
    const file = buildBackup(marks, settings)

    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.marks).toHaveLength(3)
    expect(result.marks[0]!.token17).toBe('token1')
    expect(result.marks[0]!.status).toBe('propus')
    expect(result.marks[0]!.note).toBe('note1')
    expect(result.settings.showS14).toBe(true)
    expect(result.settings.zoom).toBe(14)
    expect(result.settings.rangeCenter).toEqual([45.71, 21.31])
  })

  it('round-trip with dataset', () => {
    const dataset = { pois: [{ id: 'p1' }], cells: [{ token: 'c1' }] }
    const file = buildBackup([makeMark('t1')], makeSettings(), dataset)

    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.dataset).toEqual(dataset)
  })

  it('rejects unknown schema version', () => {
    const file: BackupFile = {
      schemaVersion: 999,
      exportedAt: 0,
      marks: [],
      settings: makeSettings()
    }
    const result = parseBackup(file)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown schema version')
  })

  it('rejects missing schemaVersion', () => {
    const result = parseBackup({ marks: [], settings: {} })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Missing schemaVersion')
  })

  it('rejects non-object input', () => {
    expect(parseBackup(null).ok).toBe(false)
    expect(parseBackup('string').ok).toBe(false)
    expect(parseBackup(42).ok).toBe(false)
    expect(parseBackup([1, 2, 3]).ok).toBe(false)
  })

  it('handles invalid JSON (non-object)', () => {
    const result = parseBackup('not json')
    expect(result.ok).toBe(false)
  })

  it('filters out invalid marks', () => {
    const file: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [
        makeMark('valid1', 'propus'),
        { token17: '', status: 'propus', note: '', updatedAt: 0 }, // empty token
        { token17: 'bad', status: 'invalid-status' as MarkStatus, note: '', updatedAt: 0 }, // bad status
        { token17: 'no-status', note: '', updatedAt: 0 } as unknown as ExportedMark, // missing status
        'not-an-object' as unknown as ExportedMark,
        null as unknown as ExportedMark
      ],
      settings: makeSettings()
    }
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.marks).toHaveLength(1)
    expect(result.marks[0]!.token17).toBe('valid1')
  })

  it('handles missing marks array', () => {
    const file: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [],
      settings: makeSettings()
    }
    const noMarks = { ...file }
    delete (noMarks as Record<string, unknown>).marks
    const result = parseBackup(noMarks)
    expect(result.ok).toBe(true)
    expect(result.marks).toHaveLength(0)
  })

  it('handles missing settings (uses defaults)', () => {
    const file: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [],
      settings: {} as unknown as ExportedSettings
    }
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.settings.zoom).toBe(13)
    expect(result.settings.showS14).toBe(false)
  })

  it('handles partial settings (fills defaults)', () => {
    const file: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [],
      settings: { zoom: 15, showS14: true } as unknown as ExportedSettings
    }
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.settings.zoom).toBe(15)
    expect(result.settings.showS14).toBe(true)
    expect(result.settings.showS17).toBe(false)
  })

  it('accepts all valid mark statuses', () => {
    const statuses: MarkStatus[] = ['planificat', 'propus', 'in-review', 'respins', 'aprobat']
    for (const status of statuses) {
      const file: BackupFile = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: 0,
        marks: [makeMark('t', status)],
        settings: makeSettings()
      }
      const result = parseBackup(file)
      expect(result.ok).toBe(true)
      expect(result.marks).toHaveLength(1)
    }
  })

  it('preserves note and updatedAt', () => {
    const marks = [makeMark('t1', 'propus', 'my note', 12345)]
    const file = buildBackup(marks, makeSettings())
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.marks[0]!.note).toBe('my note')
    expect(result.marks[0]!.updatedAt).toBe(12345)
  })

  it('old backup with retired POI keys gets the per-kind toggles on', () => {
    const file: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [],
      settings: {
        center: [45.7, 21.3],
        zoom: 13,
        showPois: true,
        showOtherPois: true,
        stopGymOnly: true,
        showPoiImages: false
        // showGyms / showStops intentionally omitted (old backup)
      } as unknown as ExportedSettings
    }
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.settings.showGyms).toBe(true)
    expect(result.settings.showStops).toBe(true)
    expect(result.settings.showOtherPois).toBe(true)
  })
})

describe('sanitizeDataset', () => {
  const goodPoi = {
    id: 'p1',
    lat: 45.7,
    lng: 21.2,
    title: 'Synthetic Stop A',
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }],
    cellToken: '47455d01'
  }
  const goodCell = {
    token: '47455d01',
    count: 3,
    truncated: false,
    generatedTimestamp: 1,
    snapshot: null,
    level: 14
  }

  it('keeps valid entries untouched', () => {
    const r = sanitizeDataset({ pois: [goodPoi], cells: [goodCell] })
    expect(r.pois).toEqual([goodPoi])
    expect(r.cells).toEqual([goodCell])
    expect(r.droppedPois).toBe(0)
    expect(r.droppedCells).toBe(0)
  })

  it('drops POIs with a missing id or bad coordinates and counts them', () => {
    const r = sanitizeDataset({
      pois: [
        goodPoi,
        { ...goodPoi, id: '' },
        { ...goodPoi, id: 'x', lat: 'nope' },
        { ...goodPoi, id: 'y', lat: 123 },
        { ...goodPoi, id: 'z', lng: NaN },
        null,
        'str'
      ],
      cells: []
    })
    expect(r.pois).toHaveLength(1)
    expect(r.droppedPois).toBe(6)
  })

  it('drops cells whose token is not hex and keeps lowercase tokens', () => {
    const r = sanitizeDataset({
      pois: [],
      cells: [
        goodCell,
        { ...goodCell, token: 'ZZ' },
        { ...goodCell, token: '' },
        { ...goodCell, token: '47455D02' }
      ]
    })
    expect(r.cells.map((c) => c.token)).toEqual(['47455d01', '47455d02'])
    expect(r.droppedCells).toBe(2)
  })

  it('fills missing optional fields with safe defaults', () => {
    const r = sanitizeDataset({ pois: [{ id: 'a', lat: 1, lng: 2 }], cells: [{ token: 'ab' }] })
    expect(r.pois[0]).toEqual({
      id: 'a',
      lat: 1,
      lng: 2,
      title: '',
      description: '',
      address: '',
      imageUrl: '',
      communityContributed: false,
      game: [],
      cellToken: ''
    })
    expect(r.cells[0]).toEqual({
      token: 'ab',
      count: 0,
      truncated: false,
      generatedTimestamp: null,
      snapshot: null,
      level: null
    })
  })

  it('deduplicates by id/token, keeping the last', () => {
    const r = sanitizeDataset({
      pois: [goodPoi, { ...goodPoi, title: 'second' }],
      cells: [goodCell, { ...goodCell, count: 9 }]
    })
    expect(r.pois).toHaveLength(1)
    expect(r.pois[0]!.title).toBe('second')
    expect(r.cells[0]!.count).toBe(9)
  })

  it('malformed game entries are skipped, not fatal', () => {
    const r = sanitizeDataset({
      pois: [{ ...goodPoi, game: [null, 3, { entity: 'GYM' }] }],
      cells: []
    })
    expect(r.pois[0]!.game).toEqual([{ entity: 'GYM', status: '', brand: '' }])
  })
})

describe('parseBackup settings validation', () => {
  it('clamps absurd numbers from a hand-edited backup', () => {
    const file = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      marks: [],
      settings: { zoom: 500, rangeRadius: -3, s14MinZoom: 0, center: [999, 0] }
    }
    const r = parseBackup(file)
    expect(r.ok).toBe(true)
    expect(r.settings.zoom).toBe(19)
    expect(r.settings.rangeRadius).toBe(20)
    expect(r.settings.s14MinZoom).toBe(1)
    expect(r.settings.center).toEqual([45.7649, 21.2531])
  })

  it('defaults agree with the settings store defaults (s14MinZoom 13)', () => {
    const r = parseBackup({ schemaVersion: SCHEMA_VERSION, exportedAt: 0, marks: [], settings: {} })
    expect(r.settings).toEqual(defaultSettings())
    expect(r.settings.s14MinZoom).toBe(13)
  })
})

describe('backup keeps the cell-color and mark-visibility settings', () => {
  it('round-trips them through build + parse', () => {
    const file = buildBackup([], makeSettings())
    const r = parseBackup(JSON.parse(JSON.stringify(file)))
    expect(r.ok).toBe(true)
    expect(r.settings.showCellUncertain).toBe(false)
    expect(r.settings.showCellFree).toBe(true)
    expect(r.settings.hiddenMarkStatuses).toEqual(['respins'])
  })

  it('an older backup without them gets the defaults', () => {
    const r = parseBackup({ schemaVersion: SCHEMA_VERSION, exportedAt: 0, marks: [], settings: {} })
    expect(r.settings.showCellOccupied).toBe(true)
    expect(r.settings.showCellFree).toBe(false)
    expect(r.settings.hiddenMarkStatuses).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import {
  parseBackup,
  buildBackup,
  SCHEMA_VERSION,
  type BackupFile,
  type ExportedMark,
  type ExportedSettings,
  type MarkStatus
} from '../backup'

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
    s14MinZoom: 12,
    s17MinZoom: 16,
    showPois: true,
    showOtherPois: false,
    stopGymOnly: true,
    powerspotCounts: false,
    showRange: false,
    rangeRadius: 100,
    rangeCenter: [45.71, 21.31],
    showRangeRings: false,
    showS14Stats: true,
    satelliteView: false
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
    // Remove marks to simulate
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
    expect(result.settings.zoom).toBe(13) // default
    expect(result.settings.showS14).toBe(false) // default
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
    expect(result.settings.showS17).toBe(false) // default
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
    // makeMark signature: (token17, status, note, updatedAt)
    const file = buildBackup(marks, makeSettings())
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    expect(result.marks[0]!.note).toBe('my note')
    expect(result.marks[0]!.updatedAt).toBe(12345)
  })
})

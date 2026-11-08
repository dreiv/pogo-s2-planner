import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CENTER,
  SETTINGS_VERSION,
  clampRangeRadius,
  defaultSettings,
  parseStoredSettings,
  serializeSettings,
  validateSettings
} from '../settings'

describe('validateSettings', () => {
  it('returns defaults for non-objects', () => {
    expect(validateSettings(null)).toEqual(defaultSettings())
    expect(validateSettings('x')).toEqual(defaultSettings())
    expect(validateSettings([1])).toEqual(defaultSettings())
  })

  it('clamps out-of-range numbers instead of keeping them', () => {
    const s = validateSettings({ zoom: 99, s14MinZoom: -5, s17MinZoom: 0, rangeRadius: 100000 })
    expect(s.zoom).toBe(19)
    expect(s.s14MinZoom).toBe(1)
    expect(s.s17MinZoom).toBe(1)
    expect(s.rangeRadius).toBe(500)
  })

  it('rejects NaN/Infinity and non-numbers', () => {
    const s = validateSettings({ zoom: NaN, rangeRadius: Infinity, s14MinZoom: '14' })
    expect(s.zoom).toBe(defaultSettings().zoom)
    expect(s.rangeRadius).toBe(defaultSettings().rangeRadius)
    expect(s.s14MinZoom).toBe(defaultSettings().s14MinZoom)
  })

  it('rejects out-of-range or malformed coordinates', () => {
    expect(validateSettings({ center: [91, 0] }).center).toEqual(DEFAULT_CENTER)
    expect(validateSettings({ center: [0, 181] }).center).toEqual(DEFAULT_CENTER)
    expect(validateSettings({ center: [1] }).center).toEqual(DEFAULT_CENTER)
    expect(validateSettings({ rangeCenter: ['a', 1] }).rangeCenter).toBeNull()
    expect(validateSettings({ rangeCenter: [45, 21] }).rangeCenter).toEqual([45, 21])
  })

  it('keeps valid booleans and falls back for wrong types', () => {
    const s = validateSettings({ showS14: true, showS17: 'yes', showPoiImages: false })
    expect(s.showS14).toBe(true)
    expect(s.showS17).toBe(false)
    expect(s.showPoiImages).toBe(false)
  })
})

describe('parseStoredSettings / migrations', () => {
  it('returns defaults for null, garbage and non-object JSON', () => {
    expect(parseStoredSettings(null)).toEqual(defaultSettings())
    expect(parseStoredSettings('{not json')).toEqual(defaultSettings())
    expect(parseStoredSettings('[1,2]')).toEqual(defaultSettings())
  })

  it('round-trips through serializeSettings', () => {
    const s = { ...defaultSettings(), showS14: true, zoom: 15, rangeCenter: [45.7, 21.2] as [number, number] }
    expect(parseStoredSettings(serializeSettings(s))).toEqual(s)
  })

  it('writes the current version', () => {
    expect(JSON.parse(serializeSettings(defaultSettings())).version).toBe(SETTINGS_VERSION)
  })

  it('legacy (unversioned) storage: retired default s14MinZoom=12 yields the new default', () => {
    const legacy = JSON.stringify({ ...defaultSettings(), s14MinZoom: 12, showS17: true })
    const s = parseStoredSettings(legacy)
    expect(s.s14MinZoom).toBe(defaultSettings().s14MinZoom)
    expect(s.showS17).toBe(true)
  })

  it('legacy storage: a custom s14MinZoom is kept', () => {
    const s = parseStoredSettings(JSON.stringify({ s14MinZoom: 15 }))
    expect(s.s14MinZoom).toBe(15)
  })

  it('current-version storage: s14MinZoom=12 is a deliberate choice and is kept', () => {
    const s = parseStoredSettings(JSON.stringify({ version: SETTINGS_VERSION, s14MinZoom: 12 }))
    expect(s.s14MinZoom).toBe(12)
  })

  it('a bad stored value cannot reach the map code', () => {
    const s = parseStoredSettings(JSON.stringify({ version: SETTINGS_VERSION, zoom: 400, center: 'x' }))
    expect(s.zoom).toBe(19)
    expect(s.center).toEqual(DEFAULT_CENTER)
  })

  it('data from a newer build is validated but not migrated', () => {
    const s = parseStoredSettings(JSON.stringify({ version: SETTINGS_VERSION + 5, zoom: 14, extra: 1 }))
    expect(s.zoom).toBe(14)
    expect('extra' in s).toBe(false)
  })
})

describe('clampRangeRadius', () => {
  it('clamps to 20..500', () => {
    expect(clampRangeRadius(5)).toBe(20)
    expect(clampRangeRadius(80)).toBe(80)
    expect(clampRangeRadius(900)).toBe(500)
    expect(clampRangeRadius(NaN)).toBe(80)
  })
})

import { describe, it, expect } from 'vitest'
import { splitJsonDocuments } from '../wayfarer/split'

describe('splitJsonDocuments', () => {
  it('returns nothing for empty / whitespace input', () => {
    expect(splitJsonDocuments('')).toEqual({ docs: [], errors: [] })
    expect(splitJsonDocuments('  \n ')).toEqual({ docs: [], errors: [] })
  })

  it('parses a single JSON value', () => {
    expect(splitJsonDocuments('{"a":1}')).toEqual({ docs: [{ a: 1 }], errors: [] })
  })

  it('parses concatenated documents, with or without separators', () => {
    expect(splitJsonDocuments('{"a":1}{"b":2}').docs).toEqual([{ a: 1 }, { b: 2 }])
    expect(splitJsonDocuments('{"a":1}\n\n{"b":2}').docs).toEqual([{ a: 1 }, { b: 2 }])
    expect(splitJsonDocuments('{"a":1},\n{"b":2}').docs).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('is not confused by braces and escaped quotes inside strings', () => {
    const r = splitJsonDocuments('{"t":"}{ \\" ]["}{"b":2}')
    expect(r.errors).toEqual([])
    expect(r.docs).toEqual([{ t: '}{ " ][' }, { b: 2 }])
  })

  it('strips a BOM and the )]}\' XSSI prefix', () => {
    expect(splitJsonDocuments('\uFEFF{"a":1}').docs).toEqual([{ a: 1 }])
    expect(splitJsonDocuments(")]}'\n{\"a\":1}").docs).toEqual([{ a: 1 }])
  })

  it('keeps valid documents and reports a cut-off last one', () => {
    const r = splitJsonDocuments('{"a":1}{"b":[1,2')
    expect(r.docs).toEqual([{ a: 1 }])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain('Incomplete')
  })

  it('reports stray text but still returns the documents', () => {
    const r = splitJsonDocuments('Response: {"a":1}')
    expect(r.docs).toEqual([{ a: 1 }])
    expect(r.errors).toHaveLength(1)
  })

  it('reports invalid JSON inside balanced braces and continues', () => {
    const r = splitJsonDocuments('{bad}{"b":2}')
    expect(r.docs).toEqual([{ b: 2 }])
    expect(r.errors).toHaveLength(1)
  })
})

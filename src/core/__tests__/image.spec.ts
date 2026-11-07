import { describe, it, expect } from 'vitest'
import { stablePoiImageUrl } from '../wayfarer/image'

const ID = 'SYNTHETICIMAGEID0000000000000000000001'

describe('stablePoiImageUrl', () => {
  it('accepts a plain lh3.googleusercontent.com id and adds a size suffix', () => {
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}`)).toBe(
      `https://lh3.googleusercontent.com/${ID}=s320`
    )
  })

  it('accepts other lhN hosts and ids with - and _', () => {
    const id = '-aJC1AwYaHXAUCVgh7UrR77EUfUb635H9_vb5euvf2l0'
    expect(stablePoiImageUrl(`https://lh5.googleusercontent.com/${id}`)).toBe(
      `https://lh5.googleusercontent.com/${id}=s320`
    )
  })

  it('replaces an existing size/option suffix', () => {
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}=w1200-h800-k-no`, 200)).toBe(
      `https://lh3.googleusercontent.com/${ID}=s200`
    )
  })

  it('clamps the size', () => {
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}`, 5)).toContain('=s64')
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}`, 9999)).toContain('=s1024')
  })

  it('rejects temporary / signed links (query string or fragment)', () => {
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}?Expires=1&Signature=a`)).toBeNull()
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}?token=abc`)).toBeNull()
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/${ID}#x`)).toBeNull()
  })

  it('rejects non-https, other hosts, multi-segment paths and short ids', () => {
    expect(stablePoiImageUrl(`http://lh3.googleusercontent.com/${ID}`)).toBeNull()
    expect(stablePoiImageUrl(`https://example.com/${ID}`)).toBeNull()
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com.evil.com/${ID}`)).toBeNull()
    expect(stablePoiImageUrl(`https://lh3.googleusercontent.com/pw/${ID}`)).toBeNull()
    expect(stablePoiImageUrl('https://lh3.googleusercontent.com/short')).toBeNull()
  })

  it('returns null for empty / invalid input', () => {
    expect(stablePoiImageUrl('')).toBeNull()
    expect(stablePoiImageUrl(undefined)).toBeNull()
    expect(stablePoiImageUrl('not a url')).toBeNull()
  })
})

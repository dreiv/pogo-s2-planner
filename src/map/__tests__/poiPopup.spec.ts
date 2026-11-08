import { describe, it, expect } from 'vitest'
import { buildPoiPopupContent } from '../../map/poiPopup'
import type { ParsedPoi } from '../../core/wayfarer/parse'

function makePoi(overrides: Partial<ParsedPoi> = {}): ParsedPoi {
  return {
    id: 'test-poi',
    lat: 45.7,
    lng: 21.3,
    title: 'Test Stop',
    description: 'A test description',
    address: 'Test Street 1',
    imageUrl: '',
    communityContributed: false,
    game: [],
    cellToken: 'test-cell',
    ...overrides
  }
}

const noopResize = () => {}

describe('buildPoiPopupContent', () => {
  it('stop with stable URL contains img with =s320 suffix', () => {
    const poi = makePoi({
      imageUrl: 'https://lh3.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      game: [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'stop', { showImages: true, onResize: noopResize })
    const img = el.querySelector('img.poi-photo') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img!.src).toContain('=s320')
  })

  it('URL with query string (temporary) produces no img', () => {
    const poi = makePoi({
      imageUrl:
        'https://lh3.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz012345?Expires=123&Signature=abc',
      game: [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'stop', { showImages: true, onResize: noopResize })
    expect(el.querySelector('img')).toBeNull()
  })

  it('other kind produces no img even with stable URL', () => {
    const poi = makePoi({
      imageUrl: 'https://lh3.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      game: []
    })
    const el = buildPoiPopupContent(poi, 'other', { showImages: true, onResize: noopResize })
    expect(el.querySelector('img')).toBeNull()
  })

  it('powerspot kind produces no img even with stable URL', () => {
    const poi = makePoi({
      imageUrl: 'https://lh3.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      game: [{ entity: 'POWERSPOT', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'powerspot', { showImages: true, onResize: noopResize })
    expect(el.querySelector('img')).toBeNull()
  })

  it('showImages=false produces no img', () => {
    const poi = makePoi({
      imageUrl: 'https://lh3.googleusercontent.com/AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      game: [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'stop', { showImages: false, onResize: noopResize })
    expect(el.querySelector('img')).toBeNull()
  })

  it('title with <script> appears as text, not as element', () => {
    const poi = makePoi({
      title: '<script>alert("xss")</script>',
      imageUrl: ''
    })
    const el = buildPoiPopupContent(poi, 'stop', { showImages: true, onResize: noopResize })
    const scriptEl = el.querySelector('script')
    expect(scriptEl).toBeNull()
    const strong = el.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('<script>alert("xss")</script>')
  })

  it('gym with stable URL contains img', () => {
    const poi = makePoi({
      imageUrl: 'https://lh4.googleusercontent.com/ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKk',
      game: [{ entity: 'GYM', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'gym', { showImages: true, onResize: noopResize })
    const img = el.querySelector('img.poi-photo')
    expect(img).not.toBeNull()
  })

  it('empty imageUrl produces no img', () => {
    const poi = makePoi({
      imageUrl: '',
      game: [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    })
    const el = buildPoiPopupContent(poi, 'stop', { showImages: true, onResize: noopResize })
    expect(el.querySelector('img')).toBeNull()
  })
})

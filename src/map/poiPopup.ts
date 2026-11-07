/**
 * POI popup content builder — creates DOM elements (no innerHTML).
 * Image is only included for stop/gym with a stable URL.
 */
import type { ParsedPoi } from '../core/wayfarer/parse'
import type { PoiKind } from '../core/classify'
import { stablePoiImageUrl } from '../core/wayfarer/image'

export interface PoiPopupOptions {
  showImages: boolean
  onResize: () => void
}

/**
 * Build the popup content as a DOM element.
 * Uses textContent for all text (safe against injection).
 * Image is only added for stop/gym with a stable URL and showImages=true.
 */
export function buildPoiPopupContent(
  poi: ParsedPoi,
  kind: PoiKind,
  opts: PoiPopupOptions
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'poi-popup'

  // Title
  if (poi.title) {
    const titleEl = document.createElement('strong')
    titleEl.textContent = poi.title
    container.appendChild(titleEl)
  }

  // Description
  if (poi.description) {
    const descEl = document.createElement('p')
    descEl.textContent = poi.description
    container.appendChild(descEl)
  }

  // Address
  if (poi.address) {
    const addrEl = document.createElement('small')
    addrEl.textContent = poi.address
    container.appendChild(addrEl)
  }

  // Kind label
  const kindEl = document.createElement('em')
  kindEl.textContent = kind
  container.appendChild(kindEl)

  // Image: only for stop/gym, stable URL, and showImages enabled
  if (opts.showImages && (kind === 'stop' || kind === 'gym')) {
    const src = stablePoiImageUrl(poi.imageUrl, 320)
    if (src) {
      const img = document.createElement('img')
      img.className = 'poi-photo'
      img.alt = poi.title || 'POI photo'
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.addEventListener('load', opts.onResize)
      img.addEventListener('error', () => {
        img.remove()
        opts.onResize()
      })
      img.src = src
      container.appendChild(img)
    }
  }

  return container
}

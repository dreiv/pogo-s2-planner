// DOM nodes + textContent only (no innerHTML); photos only for stop/gym with a stable URL.
import type { ParsedPoi } from '../core/wayfarer/parse'
import type { PoiKind } from '../core/classify'
import { stablePoiImageUrl } from '../core/wayfarer/image'

export interface PoiPopupOptions {
  showImages: boolean
  onResize: () => void
}

const KIND_LABEL: Record<PoiKind, string> = {
  stop: 'PokéStop',
  gym: 'Gym',
  powerspot: 'Power Spot',
  other: 'Other'
}

export function buildPoiPopupContent(
  poi: ParsedPoi,
  kind: PoiKind,
  opts: PoiPopupOptions
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'poi-popup'

  const header = document.createElement('div')
  header.className = 'poi-popup-header'

  const badge = document.createElement('span')
  badge.className = `poi-badge poi-badge-${kind}`
  badge.textContent = KIND_LABEL[kind]
  header.appendChild(badge)

  if (poi.title) {
    const titleEl = document.createElement('strong')
    titleEl.className = 'poi-popup-title'
    titleEl.textContent = poi.title
    header.appendChild(titleEl)
  }
  container.appendChild(header)

  if (poi.description) {
    const descEl = document.createElement('p')
    descEl.className = 'poi-popup-desc'
    descEl.textContent = poi.description
    container.appendChild(descEl)
  }

  if (poi.address) {
    const addrEl = document.createElement('small')
    addrEl.className = 'poi-popup-address'
    addrEl.textContent = poi.address
    container.appendChild(addrEl)
  }

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

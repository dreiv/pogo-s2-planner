/**
 * POI photo URL sanitizer (pure).
 *
 * Wayfarer exports `mainImage` as a Google user-content URL. We only show an image when
 * the URL looks like a permanent link:
 *  - https, host lh<N>.googleusercontent.com
 *  - a single path segment (the image id), no query string and no fragment
 *    (signed/expiring links carry `?Expires=...&Signature=...` / `token=` / `X-Goog-*`)
 *  - an id that is long enough to be a real id
 * Anything else returns null (=> no <img> at all).
 *
 * The returned URL gets a size suffix (`=s320`) so we never download full-size photos.
 * This is a heuristic: the UI must still hide the <img> on load error.
 */

const HOST = /^lh\d+\.googleusercontent\.com$/i
// id characters used by googleusercontent ids, optional existing size/option suffix.
const PATH = /^\/([A-Za-z0-9_-]{20,})(=[A-Za-z0-9-]+)?$/

export function stablePoiImageUrl(raw: string | null | undefined, sizePx = 320): string | null {
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (!HOST.test(u.hostname)) return null
  if (u.search !== '' || u.hash !== '') return null
  if (u.username !== '' || u.password !== '' || u.port !== '') return null
  const m = PATH.exec(u.pathname)
  if (!m) return null
  const size = Math.min(1024, Math.max(64, Math.round(sizePx)))
  return `https://${u.hostname.toLowerCase()}/${m[1]}=s${size}`
}

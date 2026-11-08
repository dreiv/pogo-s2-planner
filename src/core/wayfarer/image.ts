/**
 * Only permanent googleusercontent links are shown: https, host lh<N>.googleusercontent.com,
 * a single path segment (the id), no query/fragment (signed links expire), id long enough.
 * Anything else returns null. A size suffix (`=s320`) avoids full-size downloads.
 * Heuristic: the UI must still hide the <img> on load error.
 */

const HOST = /^lh\d+\.googleusercontent\.com$/i
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

/**
 * Split pasted text into one or more JSON documents (pure).
 * Handles: a single JSON value, several concatenated values (`{...}{...}` or separated by
 * newlines/commas), a leading UTF-8 BOM and the `)]}'` XSSI prefix. Never throws.
 */

export interface SplitResult {
  docs: unknown[]
  errors: string[]
}

/** Index of the bracket that closes the value starting at `start`, or -1 if incomplete. */
function findEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function nextStart(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') return i
  }
  return text.length
}

export function splitJsonDocuments(input: string): SplitResult {
  const text = input
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^\)\]\}'\s*/, '')
  if (!text) return { docs: [], errors: [] }

  // Fast path: the whole text is one JSON value.
  try {
    return { docs: [JSON.parse(text)], errors: [] }
  } catch {
    // fall through to the scanner
  }

  const docs: unknown[] = []
  const errors: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === ',' || /\s/.test(ch)) {
      i++
      continue
    }
    if (ch !== '{' && ch !== '[') {
      errors.push(`Unexpected text at position ${i} ("${text.slice(i, i + 20)}…"), ignored.`)
      i = nextStart(text, i + 1)
      continue
    }
    const end = findEnd(text, i)
    if (end === -1) {
      errors.push(`Incomplete JSON starting at position ${i} (was the copy cut off?).`)
      break
    }
    try {
      docs.push(JSON.parse(text.slice(i, end + 1)))
    } catch (e) {
      errors.push(`Invalid JSON at position ${i}: ${(e as Error).message}`)
    }
    i = end + 1
  }
  return { docs, errors }
}

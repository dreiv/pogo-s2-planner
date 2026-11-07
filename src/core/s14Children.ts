/**
 * Memoized S17 children of an S14 cell.
 * Module-level cache so repeated stats calls don't re-enumerate the 64 children.
 */
import { allDescendantTokens } from './s2'

const cache = new Map<string, string[]>()

/**
 * Return the 64 S17 child tokens of an S14 cell (memoized).
 */
export function s14Children(s14Token: string): string[] {
  let children = cache.get(s14Token)
  if (!children) {
    children = allDescendantTokens(s14Token, 17)
    cache.set(s14Token, children)
  }
  return children
}

/**
 * Clear the memo (e.g. between test runs or dataset revisions if needed).
 */
export function clearS14ChildrenCache(): void {
  cache.clear()
}

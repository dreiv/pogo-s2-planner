import { nextTick } from 'vue'
import { useUiStore } from '../stores/ui'

export async function revealSection(id: string): Promise<void> {
  useUiStore().setOpen(id, true)
  await nextTick()
  const el = document.getElementById(`section-${id}`)
  if (!el || typeof el.scrollIntoView !== 'function') return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
}

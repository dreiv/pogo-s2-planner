<script lang="ts">
let activeClose: (() => void) | null = null
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { TERMS, type TermId } from '../glossary'
import '../ui.css'

const props = defineProps<{ term: TermId }>()

const entry = computed(() => TERMS[props.term])
const open = ref(false)
const panelId = useId()
const btnRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0, width: 260 })

function closeQuietly(): void {
  close(false)
}

function close(returnFocus: boolean): void {
  if (!open.value) return
  open.value = false
  removeListeners()
  if (activeClose === closeQuietly) activeClose = null
  if (returnFocus) btnRef.value?.focus()
}

function place(): void {
  const btn = btnRef.value
  const panel = panelRef.value
  if (!btn || !panel) return
  const r = btn.getBoundingClientRect()
  const width = Math.min(280, window.innerWidth - 16)
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
  const height = panel.offsetHeight
  let top = r.bottom + 6
  if (top + height > window.innerHeight - 8 && r.top - 6 - height >= 8) {
    top = r.top - 6 - height
  }
  pos.value = { top, left, width }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close(true)
  }
}

function onPointerDown(e: PointerEvent): void {
  const target = e.target as Node | null
  if (target && (btnRef.value?.contains(target) || panelRef.value?.contains(target))) return
  close(false)
}

function onScroll(e: Event): void {
  const target = e.target as Node | null
  if (target && panelRef.value?.contains(target)) return
  close(false)
}

function onResize(): void {
  close(false)
}

function addListeners(): void {
  document.addEventListener('keydown', onKeydown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
}

function removeListeners(): void {
  document.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
}

async function toggle(): Promise<void> {
  if (open.value) {
    close(false)
    return
  }
  activeClose?.()
  open.value = true
  activeClose = closeQuietly
  await nextTick()
  place()
  addListeners()
}

onBeforeUnmount(() => {
  if (open.value) close(false)
  removeListeners()
})
</script>

<template>
  <span class="info-tip">
    <button
      ref="btnRef"
      type="button"
      class="info-tip-btn"
      :aria-label="`More info: ${entry.label}`"
      :aria-expanded="open"
      @click="toggle"
    >
      <span aria-hidden="true">i</span>
    </button>
    <span class="sr-only" role="status">{{ open ? `${entry.label}. ${entry.text}` : '' }}</span>
    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panelRef"
        class="info-tip-panel"
        aria-hidden="true"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }"
      >
        <strong class="info-tip-title">{{ entry.label }}</strong>
        <p class="info-tip-text">{{ entry.text }}</p>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.info-tip {
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: middle;
}

.info-tip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font: italic 700 12px/1 Georgia, serif;
  cursor: pointer;
}

.info-tip-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.info-tip-btn[aria-expanded='true'] {
  background: var(--accent-blue-bg);
  border-color: var(--accent-blue);
  color: var(--accent-blue-text);
}

.info-tip-panel {
  position: fixed;
  z-index: 3000;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  font-size: 13px;
  line-height: 1.4;
}

.info-tip-title {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}

.info-tip-text {
  margin: 0;
}

@media (pointer: coarse) {
  .info-tip-btn {
    width: 32px;
    height: 32px;
  }
}
</style>

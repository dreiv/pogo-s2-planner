<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import InfoTip from './InfoTip.vue'
import { useMarksStore } from '../stores/marks'
import { useDatasetStore } from '../stores/dataset'
import type { CellMark, MarkStatus } from '../data/db'
import { CELL_STATE_COLORS, MARK_STATUS_COLORS } from '../theme'
import { MARK_STATUS_LABELS, MARK_STATUS_ORDER } from '../markStyle'
import type { CellState } from '../core/classify'
import '../ui.css'

const OCCUPANCY_TEXT: Record<CellState, string> = {
  occupied: 'Occupied: an active stop or gym is already here',
  free: 'Free: no active stop or gym here',
  'free-uncertain': 'Free, but this S14 cell has incomplete data',
  unknown: 'No data for this area yet'
}

const marks = useMarksStore()
const dataset = useDatasetStore()

const radioName = `mark-status-${useId()}`
const noteId = useId()

const selectedToken = ref<string | null>(null)
const noteInput = ref('')
const removed = ref<CellMark | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

const currentMark = computed(() =>
  selectedToken.value ? marks.markByToken.get(selectedToken.value) : undefined
)

// Same memoized resolver the map uses: one POI index for the whole app.
const occupancy = computed<CellState | null>(() => {
  const token = selectedToken.value
  return token ? dataset.cellStateResolver(token) : null
})

const markCountText = computed(() => {
  const n = marks.marks.length
  return `${n} marked ${n === 1 ? 'cell' : 'cells'}`
})

// Typing a note must not rewrite the DB and restyle every polygon on each keystroke:
// the note is committed after a short pause, on blur, when the cell/status changes, or on unmount.
const NOTE_DEBOUNCE_MS = 400
let noteTimer: ReturnType<typeof setTimeout> | null = null
let pendingNote: { token: string; note: string } | null = null

function cancelNote(): void {
  if (noteTimer !== null) {
    clearTimeout(noteTimer)
    noteTimer = null
  }
  pendingNote = null
}

function flushNote(): void {
  if (noteTimer !== null) {
    clearTimeout(noteTimer)
    noteTimer = null
  }
  const pending = pendingNote
  pendingNote = null
  if (!pending) return
  const mark = marks.markByToken.get(pending.token)
  if (mark) void marks.setMark(pending.token, mark.status, pending.note)
}

function selectCell(token: string): void {
  flushNote()
  selectedToken.value = token
  noteInput.value = marks.markByToken.get(token)?.note ?? ''
}

function setStatus(status: MarkStatus): void {
  if (!selectedToken.value) return
  cancelNote()
  void marks.setMark(selectedToken.value, status, noteInput.value)
}

function onNoteInput(e: Event): void {
  const note = (e.target as HTMLInputElement).value
  noteInput.value = note
  const token = selectedToken.value
  if (!token || !marks.markByToken.has(token)) return
  pendingNote = { token, note }
  if (noteTimer !== null) clearTimeout(noteTimer)
  noteTimer = setTimeout(flushNote, NOTE_DEBOUNCE_MS)
}

async function removeMark(): Promise<void> {
  const token = selectedToken.value
  const mark = currentMark.value
  if (!token || !mark) return
  cancelNote()
  await marks.removeMark(token)
  noteInput.value = ''
  removed.value = mark
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    removed.value = null
  }, 8000)
}

async function undoRemove(): Promise<void> {
  const mark = removed.value
  if (!mark) return
  await marks.setMark(mark.token17, mark.status, mark.note)
  removed.value = null
  if (undoTimer) clearTimeout(undoTimer)
  if (selectedToken.value === mark.token17) noteInput.value = mark.note
}

onBeforeUnmount(() => {
  if (undoTimer) clearTimeout(undoTimer)
  flushNote()
})

defineExpose({ selectCell })
</script>

<template>
  <CollapsibleSection id="marks" title="Manual marks">
    <p v-if="!selectedToken" class="hint">
      Click a cell on the map to select it, then set its status here. Turn on the S17 grid to see
      the cells.
    </p>

    <div v-else class="selected-card">
      <div class="card-head">
        <span class="card-label">Selected cell</span>
        <code class="token" :title="selectedToken">S17 {{ selectedToken.slice(-8) }}</code>
      </div>
      <p v-if="occupancy" class="occupancy">
        <span
          class="occ-swatch"
          :style="{ background: CELL_STATE_COLORS[occupancy] }"
          :class="{ empty: occupancy === 'unknown' }"
          aria-hidden="true"
        ></span>
        <span>{{ OCCUPANCY_TEXT[occupancy] }}</span>
      </p>

      <fieldset class="status-group">
        <legend class="field-label">
          Status
          <InfoTip term="marks" />
        </legend>
        <div class="status-options">
          <label
            v-for="s in MARK_STATUS_ORDER"
            :key="s"
            class="status-opt"
            :class="{ checked: currentMark?.status === s }"
          >
            <input
              type="radio"
              class="sr-only"
              :name="radioName"
              :value="s"
              :checked="currentMark?.status === s"
              @change="setStatus(s)"
            />
            <span
              class="status-swatch"
              :style="{ background: MARK_STATUS_COLORS[s] }"
              aria-hidden="true"
            ></span>
            <span>{{ MARK_STATUS_LABELS[s] }}</span>
            <span v-if="currentMark?.status === s" class="check" aria-hidden="true">✓</span>
          </label>
        </div>
      </fieldset>

      <label class="field-label" :for="noteId">Note</label>
      <input
        :id="noteId"
        class="note-input"
        type="text"
        placeholder="Optional note"
        :value="noteInput"
        @input="onNoteInput"
        @change="flushNote"
      />

      <button
        type="button"
        class="ui-btn ui-btn--danger"
        :disabled="!currentMark"
        @click="removeMark"
      >
        Delete mark
      </button>
    </div>

    <p class="undo" role="status">
      <template v-if="removed">
        Mark deleted.
        <button type="button" class="link-btn" @click="undoRemove">Undo</button>
      </template>
    </p>

    <p v-if="marks.marks.length > 0" class="marks-count">{{ markCountText }}</p>
  </CollapsibleSection>
</template>

<style scoped>
.hint {
  margin: 4px 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.selected-card {
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-subtle);
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.token {
  font-size: 13px;
}

.occupancy {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.35;
}

.occ-swatch {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  border-radius: 2px;
  opacity: 0.85;
}

.occ-swatch.empty {
  border: 1px solid var(--border);
}

.status-group {
  margin: 0 0 10px;
  padding: 0;
  border: 0;
}

.status-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.status-opt {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.status-opt:hover {
  background: var(--bg-hover);
}

.status-opt:focus-within {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.status-opt.checked {
  border-color: var(--accent-blue);
  background: var(--accent-blue-bg);
  color: var(--accent-blue-text);
  font-weight: 600;
}

.status-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.note-input {
  width: 100%;
  min-height: 32px;
  margin-bottom: 10px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.undo {
  min-height: 0;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.marks-count {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (pointer: coarse) {
  .status-opt,
  .note-input {
    min-height: 44px;
  }
}

@media (max-width: 640px) {
  .selected-card {
    padding: 8px 10px;
    font-size: 12px;
  }
}
</style>

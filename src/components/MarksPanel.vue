<script setup lang="ts">
import { ref } from 'vue'
import { useMarksStore } from '../stores/marks'
import type { MarkStatus } from '../data/db'
import { MARK_STATUS_COLORS } from '../theme'

const marks = useMarksStore()

const STATUS_LABELS: Record<MarkStatus, string> = {
  planificat: 'Planned',
  propus: 'Proposed',
  'in-review': 'In review',
  respins: 'Rejected',
  aprobat: 'Approved'
}

const STATUS_COLORS: Record<MarkStatus, string> = MARK_STATUS_COLORS

const allStatuses: MarkStatus[] = ['planificat', 'propus', 'in-review', 'respins', 'aprobat']

// Currently selected cell (set by MapView on cell click)
const selectedToken = ref<string | null>(null)
const noteInput = ref('')

function selectCell(token: string): void {
  selectedToken.value = token
  const mark = marks.markByToken.get(token)
  noteInput.value = mark?.note ?? ''
}

function setStatus(status: MarkStatus): void {
  if (!selectedToken.value) return
  marks.setMark(selectedToken.value, status, noteInput.value)
}

function removeMark(): void {
  if (!selectedToken.value) return
  marks.removeMark(selectedToken.value)
  selectedToken.value = null
  noteInput.value = ''
}

function onNoteInput(e: Event): void {
  const target = e.target as HTMLInputElement
  noteInput.value = target.value
  if (selectedToken.value) {
    const mark = marks.markByToken.get(selectedToken.value)
    if (mark) {
      marks.setMark(selectedToken.value, mark.status, noteInput.value)
    }
  }
}

defineExpose({ selectCell })
</script>

<template>
  <section class="panel-section">
    <h3>Manual marks</h3>

    <div v-if="!selectedToken" class="marks-hint">
      Click an S17 cell to mark it.
    </div>

    <div v-else class="marks-editor">
      <div class="marks-token">
        <span class="token-label">S17:</span>
        <code>{{ selectedToken.slice(-8) }}</code>
      </div>

      <div class="status-buttons">
        <button
v-for="s in allStatuses" :key="s" class="status-btn"
          :class="{ active: marks.markByToken.get(selectedToken)?.status === s }"
          :style="{ borderColor: STATUS_COLORS[s] }" @click="setStatus(s)">
          {{ STATUS_LABELS[s] }}
        </button>
      </div>

      <input v-model="noteInput" class="note-input" type="text" placeholder="Optional note..." @input="onNoteInput" />

      <button class="remove-btn" @click="removeMark">Delete mark</button>
    </div>

    <div v-if="marks.marks.length > 0" class="marks-count">
      {{ marks.marks.length }} marked cell(s)
    </div>
  </section>
</template>

<style scoped>
.marks-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0;
}

.marks-editor {
  margin: 6px 0;
}

.marks-token {
  font-size: 11px;
  margin-bottom: 6px;
}

.token-label {
  color: var(--text-secondary);
}

.status-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.status-btn {
  font-size: 10px;
  padding: 3px 8px;
  border: 2px solid;
  border-radius: 4px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.status-btn.active {
  font-weight: 700;
}

.status-btn:hover {
  background: var(--bg-hover);
}

.note-input {
  width: 100%;
  font-size: 11px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 6px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.remove-btn {
  font-size: 11px;
  padding: 4px 8px;
  border: 1px solid var(--accent-red);
  border-radius: 4px;
  background: var(--bg-panel);
  color: var(--accent-red);
  cursor: pointer;
}

.remove-btn:hover {
  background: var(--accent-red-bg);
}

.marks-count {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 6px;
}
</style>

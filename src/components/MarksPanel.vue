<script setup lang="ts">
import { ref } from 'vue'
import { useMarksStore } from '../stores/marks'
import type { MarkStatus } from '../data/db'

const marks = useMarksStore()

const STATUS_LABELS: Record<MarkStatus, string> = {
  planificat: 'Planificat',
  propus: 'Propus',
  'in-review': 'În review',
  respins: 'Respins',
  aprobat: 'Aprobat'
}

const STATUS_COLORS: Record<MarkStatus, string> = {
  planificat: '#3b82f6',
  propus: '#f59e0b',
  'in-review': '#8b5cf6',
  respins: '#ef4444',
  aprobat: '#22c55e'
}

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
    <h3>Marcaje manuale</h3>

    <div v-if="!selectedToken" class="marks-hint">
      Click pe o celulă S17 pentru a o marca.
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

      <input v-model="noteInput" class="note-input" type="text" placeholder="Notă opțională..." @input="onNoteInput" />

      <button class="remove-btn" @click="removeMark">Șterge marcajul</button>
    </div>

    <div v-if="marks.marks.length > 0" class="marks-count">
      {{ marks.marks.length }} celulă(e) marcată(e)
    </div>
  </section>
</template>

<style scoped>
.marks-hint {
  font-size: 12px;
  color: #6b7280;
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
  color: #6b7280;
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
  background: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.status-btn.active {
  font-weight: 700;
}

.status-btn:hover {
  background: #f3f4f6;
}

.note-input {
  width: 100%;
  font-size: 11px;
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  margin-bottom: 6px;
}

.remove-btn {
  font-size: 11px;
  padding: 4px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: #fff;
  color: #ef4444;
  cursor: pointer;
}

.remove-btn:hover {
  background: #fef2f2;
}

.marks-count {
  font-size: 11px;
  color: #6b7280;
  margin-top: 6px;
}
</style>

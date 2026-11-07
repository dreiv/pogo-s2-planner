<script setup lang="ts">
import { ref } from 'vue'
import { useDatasetStore, type ImportSummary } from '../stores/dataset'

const dataset = useDatasetStore()
const pasteText = ref('')
const lastSummary = ref<ImportSummary | null>(null)
const importing = ref(false)

async function handleFileUpload(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    lastSummary.value = await dataset.importFromJson(json, file.name)
  } catch (err) {
    lastSummary.value = null
    console.error('Import failed:', err)
  } finally {
    importing.value = false
    input.value = ''
  }
}

async function handlePaste(): Promise<void> {
  if (!pasteText.value.trim()) return
  importing.value = true
  try {
    const json = JSON.parse(pasteText.value)
    lastSummary.value = await dataset.importFromJson(json, 'pasted')
    pasteText.value = ''
  } catch (err) {
    lastSummary.value = null
    console.error('Import failed:', err)
  } finally {
    importing.value = false
  }
}

async function handleClear(): Promise<void> {
  if (!confirm('Ștergi toate datele importate?')) return
  await dataset.clearAll()
  lastSummary.value = null
}
</script>

<template>
  <section class="import-panel">
    <h3>Import Wayfarer</h3>

    <div class="import-actions">
      <label class="file-btn">
        <input type="file" accept=".json" :disabled="importing" @change="handleFileUpload" />
        <span>📂 Fișier JSON</span>
      </label>
    </div>

    <textarea
v-model="pasteText" class="paste-area" placeholder="…sau lipește JSON aici" rows="4"
      :disabled="importing"></textarea>
    <button class="paste-btn" :disabled="importing || !pasteText.trim()" @click="handlePaste">
      {{ importing ? 'Se importă…' : 'Importă din text' }}
    </button>

    <!-- Summary -->
    <div v-if="lastSummary" class="summary">
      <h4>Rezumat import</h4>
      <dl>
        <dt>POI-uri</dt>
        <dd>{{ lastSummary.poiCount }}</dd>
        <dt>Pokéstop</dt>
        <dd>{{ lastSummary.stopCount }}</dd>
        <dt>Gym</dt>
        <dd>{{ lastSummary.gymCount }}</dd>
        <dt>Power Spot</dt>
        <dd>{{ lastSummary.powerSpotCount }}</dd>
        <dt>Fără GMO</dt>
        <dd>{{ lastSummary.noGmoCount }}</dd>
        <dt>Celule</dt>
        <dd>{{ lastSummary.cellCount }}</dd>
        <dt>Celule trunchiate</dt>
        <dd>{{ lastSummary.truncatedCount }}</dd>
        <dt>Warnings</dt>
        <dd>{{ lastSummary.warningCount }}</dd>
      </dl>
    </div>

    <!-- Import history -->
    <div v-if="dataset.imports.length > 0" class="imports-list">
      <h4>Importuri</h4>
      <ul>
        <li v-for="imp in dataset.imports" :key="imp.id">
          {{ imp.fileName }} — {{ imp.poiCount }} POI, {{ imp.cellCount }} celule
        </li>
      </ul>
    </div>

    <!-- Clear -->
    <button v-if="dataset.pois.length > 0" class="clear-btn" @click="handleClear">
      Șterge toate datele
    </button>
  </section>
</template>

<style scoped>
.import-panel {
  margin-bottom: 16px;
}

.import-panel h3 {
  font-size: 13px;
  text-transform: uppercase;
  color: #888;
  margin: 0 0 8px;
}

.import-actions {
  margin-bottom: 8px;
}

.file-btn {
  display: inline-block;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.file-btn input {
  display: none;
}

.paste-area {
  width: 100%;
  font-family: monospace;
  font-size: 11px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 6px;
  resize: vertical;
  margin-bottom: 8px;
}

.paste-btn {
  width: 100%;
  padding: 6px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 12px;
}

.paste-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.summary {
  background: #f9fafb;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}

.summary h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: #666;
}

.summary dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  margin: 0;
}

.summary dt {
  color: #666;
}

.summary dd {
  margin: 0;
  font-weight: 600;
}

.imports-list {
  margin-bottom: 12px;
  font-size: 12px;
}

.imports-list h4 {
  font-size: 12px;
  color: #666;
  margin: 0 0 4px;
}

.imports-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.imports-list li {
  padding: 2px 0;
  font-size: 11px;
}

.clear-btn {
  width: 100%;
  padding: 6px;
  font-size: 12px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: #fff;
  color: #ef4444;
  cursor: pointer;
}

.clear-btn:hover {
  background: #fef2f2;
}

@media (prefers-color-scheme: dark) {
  .import-panel h3 {
    color: #9ca3af;
  }

  .file-btn {
    background: #374151;
    color: #e5e7eb;
  }

  .paste-area {
    background: #111827;
    color: #e5e7eb;
    border-color: #4b5563;
  }

  .summary {
    background: #111827;
  }

  .summary h4,
  .summary dt {
    color: #9ca3af;
  }

  .imports-list h4 {
    color: #9ca3af;
  }

  .clear-btn {
    background: #1f2937;
    color: #f87171;
    border-color: #ef4444;
  }

  .clear-btn:hover {
    background: #374151;
  }
}
</style>

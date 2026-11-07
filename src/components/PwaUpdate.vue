<script setup lang="ts">
import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

// Root cause of the "dialog never goes away" bug: with registerType 'prompt' the new
// service worker stays in the `waiting` state until it receives SKIP_WAITING.
// A plain `location.reload()` keeps the OLD worker in control, so the new one is still
// waiting after the reload and `onNeedRefresh` fires again. `updateSW(true)` posts
// SKIP_WAITING and reloads once the new worker has taken control.
const needRefresh = ref(false)
const busy = ref(false)

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh.value = true
  },
  onRegisteredSW(_url, registration) {
    // Look for a new version once an hour while the app stays open.
    if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000)
  }
})

async function applyUpdate(): Promise<void> {
  busy.value = true
  try {
    await updateSW(true)
  } catch (err) {
    console.error('PWA update failed:', err)
    busy.value = false
    return
  }
  // Safety net: if the page was not reloaded by the new worker, reload ourselves.
  window.setTimeout(() => window.location.reload(), 3000)
}

function dismiss(): void {
  needRefresh.value = false
}
</script>

<template>
  <div v-if="needRefresh" class="pwa-update" role="status">
    <span>{{ busy ? 'Updating…' : 'A new version is available.' }}</span>
    <button class="pwa-update-btn" :disabled="busy" @click="applyUpdate">Refresh</button>
    <button class="pwa-update-later" :disabled="busy" @click="dismiss">Later</button>
  </div>
</template>

<style scoped>
.pwa-update {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1f2937;
  color: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  font-size: 14px;
}

.pwa-update-btn {
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  min-height: 32px;
}

.pwa-update-btn:hover:not(:disabled) {
  background: var(--accent-blue-strong);
}

.pwa-update-later {
  background: transparent;
  color: #d1d5db;
  border: none;
  font-size: 14px;
  cursor: pointer;
  min-height: 32px;
}

.pwa-update-btn:disabled,
.pwa-update-later:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>

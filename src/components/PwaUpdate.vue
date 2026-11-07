<script setup lang="ts">
import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const updateAvailable = ref(false)
const reloading = ref(false)

registerSW({
  onNeedRefresh() {
    updateAvailable.value = true
  }
})

function reload(): void {
  reloading.value = true
  // Give the UI a moment to update before the new SW takes over.
  setTimeout(() => window.location.reload(), 300)
}
</script>

<template>
  <div v-if="updateAvailable && !reloading" class="pwa-update">
    <span>Există o versiune nouă.</span>
    <button class="pwa-update-btn" @click="reload">Reîmprospătează</button>
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
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  min-height: 32px;
}

.pwa-update-btn:hover {
  background: #2563eb;
}
</style>

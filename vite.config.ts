import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
  test: {
    environment: 'jsdom'
  }
})

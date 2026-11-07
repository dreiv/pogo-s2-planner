import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import { vueTsConfigs } from '@vue/eslint-config-typescript'
import globals from 'globals'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.repomix/**', 'local-data/**', 'temp/**'],
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueTsConfigs.recommended,
  prettier,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
      },
      globals: { ...globals.browser },
    },
    rules: {
      // vue/no-unused-vars handles template usage detection
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts', 'src/**/__tests__/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'core must not import vue' },
            { name: 'pinia', message: 'core must not import pinia' },
            { name: 'leaflet', message: 'core must not import leaflet' },
            { name: 'dexie', message: 'core must not import dexie' },
          ],
          patterns: [
            { group: ['**/map', '**/map/**'], message: 'core must not import from map' },
            { group: ['**/data', '**/data/**'], message: 'core must not import from data' },
            { group: ['**/stores', '**/stores/**'], message: 'core must not import from stores' },
            { group: ['**/components', '**/components/**'], message: 'core must not import from components' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/map/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'dexie is only allowed in src/data/**' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'leaflet', message: 'leaflet is only allowed in src/map/**' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/stores/**', 'src/components/**', 'src/*.ts', 'src/*.vue'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'leaflet', message: 'leaflet is only allowed in src/map/**' },
            { name: 'dexie', message: 'dexie is only allowed in src/data/**' },
          ],
        },
      ],
    },
  },
]

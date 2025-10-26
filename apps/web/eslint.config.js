// apps/web/eslint.config.js (Flat config)
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import pluginQuasar from '@quasar/app-vite/eslint'
import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
  // ignore patterns (flat config style)
  { ignores: ['dist', 'node_modules'] },

  // Quasar’s recommended base (already sets a bunch of good defaults)
  ...pluginQuasar.configs.recommended(),

  // JS baseline
  js.configs.recommended,

  // Vue SFCs — parse <template> and <script lang="ts">
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,                  // parse .vue SFC
      parserOptions: {
        parser: tsParser,                 // parse <script lang="ts">
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      // start from Vue’s recommended rules
      ...pluginVue.configs['flat/recommended'].rules,
    },
  },

  // TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },

  // Plain JS files
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // your custom JS rules here
    },
  },

  // Keep Prettier’s “skip formatting” last
  prettierSkipFormatting,
]
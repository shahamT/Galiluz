import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // tests/eval/** is the manual OpenAI matcher eval (npm run eval:matcher) — keep it
    // out of the default deterministic suite (no real API calls / token cost in CI).
    exclude: [...configDefaults.exclude, 'tests/eval/**'],
  },
})

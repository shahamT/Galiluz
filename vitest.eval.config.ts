import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Manual eval config for the crawler same-event matcher — calls the REAL OpenAI.
// Run with: npm run eval:matcher  (requires OPENAI_API_KEY; loaded from .env by setup).
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['tests/eval/**/*.eval.test.ts'],
    setupFiles: ['tests/eval/setup.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
})

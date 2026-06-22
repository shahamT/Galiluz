import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load the repo-root .env into process.env so the matcher eval can read OPENAI_API_KEY /
// OPENAI_MODEL_WEB (vitest does not auto-load .env). Ambient env wins over the file.
try {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    if (k in process.env) continue
    process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
} catch {
  // No .env file — rely on the ambient environment (CI / shell-provided OPENAI_API_KEY).
}

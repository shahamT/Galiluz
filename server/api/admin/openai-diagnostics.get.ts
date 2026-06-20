import OpenAI from 'openai'
import { describeOpenAIError } from '@galiluz/event-format'
import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'

/**
 * TEMPORARY manager-only diagnostic for the prod OpenAI "Premature close" issue.
 * Open it in the browser while logged in as a manager:
 *   GET /api/admin/openai-diagnostics
 * It exercises three layers (raw fetch → SDK models.list → SDK chat completion) and
 * reports the exact error anatomy (cause chain incl. the undici transport code) plus
 * an env fingerprint (stray base URL / proxy / corrupted key). Compare prod vs local
 * to isolate network / SDK / config. REMOVE once the issue is resolved.
 */
async function timed(label: string, fn: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const t0 = Date.now()
  try {
    const out = await fn()
    return { label, ok: true, ms: Date.now() - t0, ...out }
  } catch (err) {
    return { label, ok: false, ms: Date.now() - t0, error: describeOpenAIError(err) }
  }
}

export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requireManager: true })

  const config = useRuntimeConfig() as Record<string, string>
  const apiKey = (config.openaiApiKey || process.env.OPENAI_API_KEY || '').trim()
  const model = (process.env.OPENAI_MODEL_WEB || 'gpt-4o').trim() || 'gpt-4o'

  // Env fingerprint — surfaces a stray base URL / proxy / corrupted key (no secret leak).
  const env = {
    node: process.version,
    region: process.env.RENDER_REGION || process.env.AWS_REGION || '(unknown)',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || '(unset → api.openai.com)',
    proxy: {
      HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '(unset)',
      HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '(unset)',
      ALL_PROXY: process.env.ALL_PROXY || process.env.all_proxy || '(unset)',
      NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || '(unset)',
    },
    key: {
      present: !!apiKey,
      len: apiKey.length,
      prefix: apiKey.slice(0, 3),
      suffix: apiKey.slice(-2),
      hasWhitespace: /\s/.test(apiKey),
    },
    model,
  }

  // 1) Raw fetch — bypasses the SDK, isolates pure network reachability.
  const rawFetch = await timed('rawFetch /v1/models', async () => {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    return { httpStatus: r.status }
  })

  // 2) SDK models.list — SDK transport, no token spend.
  const sdkModels = await timed('sdk models.list', async () => {
    const openai = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 0 })
    const list = await openai.models.list()
    return { modelCount: (list.data || []).length }
  })

  // 3) SDK chat completion — the exact path the add-event modal hits.
  const sdkChat = await timed('sdk chat.completions', async () => {
    const openai = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 0 })
    const resp = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      max_tokens: 5,
      temperature: 0,
    })
    return { content: resp.choices[0]?.message?.content?.slice(0, 20) }
  })

  return { env, tests: { rawFetch, sdkModels, sdkChat } }
})

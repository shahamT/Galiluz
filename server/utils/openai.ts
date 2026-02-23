import OpenAI from 'openai'

/** Request timeout for OpenAI API calls (ms). */
const OPENAI_TIMEOUT_MS = 60_000

let cachedClient: OpenAI | null = null
let cachedApiKey: string | undefined

/**
 * Server-side OpenAI client for event formatting (wa-bot publisher flow).
 * Returns null when OPENAI_API_KEY is not set. Client is cached per process.
 */
export function getOpenAIClient(): OpenAI | null {
  const config = useRuntimeConfig()
  const apiKey = (config.openaiApiKey as string)?.trim() || ''
  if (!apiKey) {
    return null
  }
  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient
  }
  cachedApiKey = apiKey
  cachedClient = new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
  })
  return cachedClient
}

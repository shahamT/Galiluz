import OpenAI from 'openai'

/**
 * The one place we construct an OpenAI client. It pins the SDK to Node's native
 * fetch (undici).
 *
 * Why this exists: in the bundled production output the SDK otherwise falls back to
 * node-fetch v2, which on Node 22 throws ERR_STREAM_PREMATURE_CLOSE while
 * gunzip-decompressing OpenAI's gzipped responses (node-fetch v2 predates Node 22's
 * stream internals). Native fetch decompresses correctly. The dev runtime already
 * uses native fetch, which is why the bug only ever showed in production.
 *
 * Centralizing it means no call site can forget the `fetch` option, and any future
 * client gets the correct transport for free. Pass the same options you'd pass to
 * `new OpenAI(...)` (apiKey, timeout, maxRetries, …).
 */
const nativeFetch = (...args) => globalThis.fetch(...args)

export function createOpenAIClient(options = {}) {
  return new OpenAI({ ...options, fetch: options.fetch || nativeFetch })
}

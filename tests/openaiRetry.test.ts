import { describe, it, expect } from 'vitest'
import { isRetryableOpenAIError, getRetryDelayMs } from '~/packages/event-format/openaiRetry.js'

// The whole point of this helper: transient failures retry, deterministic ones don't.
// The crawler incident was a status-less connection drop ("Premature close") that the
// old status-only check would have treated as non-retryable.
describe('isRetryableOpenAIError', () => {
  it('retries rate-limit, request-timeout and 5xx by HTTP status', () => {
    for (const status of [429, 408, 500, 502, 503, 504]) {
      expect(isRetryableOpenAIError({ status }), String(status)).toBe(true)
    }
  })

  it('does NOT retry deterministic 4xx', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableOpenAIError({ status }), String(status)).toBe(false)
    }
  })

  it('retries status-less connection drops (the Premature-close incident)', () => {
    expect(isRetryableOpenAIError({ message: 'Invalid response body while trying to fetch https://api.openai.com/v1/chat/completions: Premature close' })).toBe(true)
    expect(isRetryableOpenAIError({ message: 'socket hang up' })).toBe(true)
    expect(isRetryableOpenAIError({ message: 'fetch failed', cause: { code: 'ECONNRESET' } })).toBe(true)
    expect(isRetryableOpenAIError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isRetryableOpenAIError({ code: 'UND_ERR_SOCKET' })).toBe(true)
    expect(isRetryableOpenAIError({ name: 'APIConnectionError' })).toBe(true)
    expect(isRetryableOpenAIError({ name: 'APIConnectionTimeoutError' })).toBe(true)
  })

  it('does NOT retry status-less deterministic errors (e.g. JSON parse)', () => {
    expect(isRetryableOpenAIError({ message: 'Unexpected token < in JSON at position 0' })).toBe(false)
    expect(isRetryableOpenAIError({ name: 'SyntaxError', message: 'bad json' })).toBe(false)
    expect(isRetryableOpenAIError({})).toBe(false)
    expect(isRetryableOpenAIError(null)).toBe(false)
  })
})

describe('getRetryDelayMs', () => {
  it('honors a 429 "try again in Nms" hint (clamped 500..60000)', () => {
    expect(getRetryDelayMs({ status: 429, message: 'Rate limit reached. try again in 1234ms.' }, 0)).toBe(1234)
    expect(getRetryDelayMs({ status: 429, message: 'try again in 10ms' }, 0)).toBe(500) // clamped up
    expect(getRetryDelayMs({ status: 429, message: 'no hint here' }, 0)).toBe(2000)
  })

  it('uses exponential backoff (cap 30s) for everything else', () => {
    expect(getRetryDelayMs({ status: 500 }, 0)).toBe(1000)
    expect(getRetryDelayMs({ status: 500 }, 1)).toBe(2000)
    expect(getRetryDelayMs({ status: 500 }, 2)).toBe(4000)
    expect(getRetryDelayMs({ status: 500 }, 10)).toBe(30_000) // capped
  })
})

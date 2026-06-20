/** Max length for message text passed to OpenAI (limits prompt size + abuse). */
const MESSAGE_TEXT_MAX_LENGTH = 8000

/** Leading-line patterns that may be prompt-injection (English override attempts). Stripped only at the start. */
const LEADING_OVERRIDE_PATTERN = /^\s*(system\s*:|\s*ignore\s+(all\s+)?(previous|above|prior)\s+instructions?|\s*disregard\s+(all\s+)?(previous|above)\s*|\s*you\s+are\s+now\s+)/im

/**
 * Sanitize WhatsApp message text before using it in an OpenAI prompt: trim,
 * strip a leading instruction-override attempt, and cap length. Does not alter
 * normal Hebrew/event content. Ported from apps/wa-listener.
 */
export function sanitizeMessageForPrompt(text: unknown): string {
  if (!text || typeof text !== 'string') return ''
  let s = text.trim()
  const m = s.match(LEADING_OVERRIDE_PATTERN)
  if (m) {
    const nl = s.indexOf('\n', m.index)
    s = (nl === -1 ? '' : s.slice(nl)).trim()
  }
  if (s.length > MESSAGE_TEXT_MAX_LENGTH) s = s.slice(0, MESSAGE_TEXT_MAX_LENGTH)
  return s
}

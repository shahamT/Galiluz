/**
 * HTML sanitization for publisher event fields.
 * Strips all tags from plain-text fields; keeps a safe whitelist for fullDescription.
 */

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'])

/** Return the URL only if it has an http(s) scheme; otherwise null. Blocks javascript:, data:, etc. */
export function safeUrl(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null
  const s = val.trim()
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return s
  } catch {
    return null
  }
}

/** Remove every HTML tag from a plain-text field. */
export function stripHtml(val: unknown): string {
  return String(val ?? '').replace(/<[^>]*>/g, '').trim()
}

/**
 * Sanitize an HTML description: keep only safe structural tags, strip attributes,
 * remove script/style/iframe blocks entirely.
 */
export function sanitizeHtml(html: unknown): string {
  let s = String(html ?? '')
  // Remove content-bearing dangerous tags
  s = s.replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, '')
  // Remove self-closing dangerous tags
  s = s.replace(/<(input|link|meta|base|img|button|select|textarea)(\s[^>]*)?\/?>/gi, '')
  // Strip all tags not in the allowlist (strip attributes from kept tags too)
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\/?>/g, (_match, tag: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    const closing = _match.startsWith('</')
    return closing ? `</${t}>` : `<${t}>`
  })
  return s.trim()
}

/** Sanitize all user-supplied text fields of a publisher event payload in-place. */
export function sanitizeEventFields(body: Record<string, unknown>): void {
  if (typeof body.title === 'string') body.title = stripHtml(body.title)
  if (typeof body.shortDescription === 'string') body.shortDescription = stripHtml(body.shortDescription)
  if (typeof body.fullDescription === 'string') body.fullDescription = sanitizeHtml(body.fullDescription)

  const loc = body.location as Record<string, unknown> | undefined
  if (loc) {
    if (typeof loc.locationName === 'string') loc.locationName = stripHtml(loc.locationName)
    if (typeof loc.addressLine1 === 'string') loc.addressLine1 = stripHtml(loc.addressLine1)
    if (typeof loc.locationNotes === 'string') loc.locationNotes = stripHtml(loc.locationNotes)
    // Validate nav links — only http(s):// allowed, reject javascript: and data: URIs
    loc.wazeNavLink  = safeUrl(loc.wazeNavLink)
    loc.gmapsNavLink = safeUrl(loc.gmapsNavLink)
  }

  if (Array.isArray(body.urls)) {
    body.urls = (body.urls as any[]).map(u => ({
      ...u,
      Title: stripHtml(u.Title),
      Url:   u.type === 'phone' ? String(u.Url ?? '').trim() : (safeUrl(u.Url) ?? ''),
    }))
  }
}

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * SSRF-hardened fetch for externally-sourced image URLs (e.g. WhatsApp/Green API
 * media download links forwarded through the crawler). Untrusted URLs must never
 * be handed to a bare `fetch` — they can target loopback/metadata/private hosts.
 *
 * Defenses, in order: https-only, no embedded credentials, DNS-resolve and reject
 * any private/reserved IP (v4 + v6, including IPv4-mapped/alt-encoded forms),
 * manual redirect handling with per-hop re-validation, a hard body-size cap, a
 * request timeout, and an `image/*` content-type requirement.
 *
 * Residual: there is a small DNS-rebinding (TOCTOU) window between validation and
 * the socket connect — full closure needs connection-level IP pinning (a custom
 * undici dispatcher), which Node does not expose without adding undici as a dep.
 * Given the URL is Green-API-issued (not raw user input) and the route is
 * API_SECRET-gated, the validate-then-fetch posture is proportionate.
 */

export interface SafeImageFetchOptions {
  maxBytes?: number
  timeoutMs?: number
  maxRedirects?: number
}

export interface SafeImageResult {
  buffer: Buffer
  contentType: string
  finalUrl: string
}

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_REDIRECTS = 3

/** Parse a dotted-decimal IPv4 string into octets, or null if not a v4 literal. */
function ipv4Octets(ip: string): number[] | null {
  if (isIP(ip) !== 4) return null
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return parts
}

/** True for any IPv4 address that is not a routable public unicast address. */
function isPrivateV4(parts: number[]): boolean {
  const [a, b, c] = parts
  if (a === 0) return true // 0.0.0.0/8 "this host"
  if (a === 10) return true // 10/8 private
  if (a === 127) return true // 127/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true // 169.254/16 link-local (incl. cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12 private
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true // 192.88.99.0/24 6to4 relay anycast
  if (a === 192 && b === 168) return true // 192.168/16 private
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true // 224/4 multicast + 240/4 reserved + 255.255.255.255 broadcast
  return false
}

/** Expand any textual IPv6 form into exactly 8 16-bit groups, or null if malformed. */
function expandIpv6(input: string): number[] | null {
  let s = input.toLowerCase()
  const pct = s.indexOf('%')
  if (pct !== -1) s = s.slice(0, pct) // drop zone id

  // Embedded dotted IPv4 tail (mapped/compat/NAT64) → fold into two hextets.
  const lastColon = s.lastIndexOf(':')
  if (lastColon !== -1 && s.slice(lastColon + 1).includes('.')) {
    const v4 = ipv4Octets(s.slice(lastColon + 1))
    if (!v4) return null
    const h1 = ((v4[0] << 8) | v4[1]).toString(16)
    const h2 = ((v4[2] << 8) | v4[3]).toString(16)
    s = `${s.slice(0, lastColon + 1)}${h1}:${h2}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : []

  let groups: string[]
  if (halves.length === 1) {
    if (head.length !== 8) return null // no "::" → must be fully specified
    groups = head
  } else {
    const missing = 8 - (head.length + tail.length)
    if (missing < 0) return null
    groups = [...head, ...Array(missing).fill('0'), ...tail]
  }
  if (groups.length !== 8) return null

  const nums = groups.map((g) => (g === '' ? 0 : parseInt(g, 16)))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null
  return nums
}

/** True for any IPv6 address that is not a routable public unicast address. */
function isPrivateV6(ip: string): boolean {
  const g = expandIpv6(ip)
  if (!g) return true // unparseable → fail closed

  const allZeroHigh = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0

  // ::  unspecified  and  ::1 loopback
  if (allZeroHigh && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true

  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96, deprecated) → judge the embedded v4.
  if (allZeroHigh && (g[5] === 0xffff || g[5] === 0)) {
    const a = g[6] >> 8, b = g[6] & 0xff, c = g[7] >> 8, d = g[7] & 0xff
    return isPrivateV4([a, b, c, d])
  }

  // NAT64 well-known prefix 64:ff9b::/96 → judge the embedded v4.
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    const a = g[6] >> 8, b = g[6] & 0xff, c = g[7] >> 8, d = g[7] & 0xff
    return isPrivateV4([a, b, c, d])
  }

  // 6to4 2002::/16 → the v4 is in bits 16-47 (g[1]:g[2]); judge it (deprecated, but
  // a 6to4 address wrapping a private/loopback v4 must not be admitted).
  if (g[0] === 0x2002) {
    const a = g[1] >> 8, b = g[1] & 0xff, c = g[2] >> 8, d = g[2] & 0xff
    return isPrivateV4([a, b, c, d])
  }

  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true // fec0::/10 deprecated site-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

/**
 * True if `ip` is a loopback / private / link-local / reserved address that an
 * outbound fetch must never target. Fails closed (returns true) on anything it
 * cannot positively classify as a public unicast address.
 */
export function isPrivateOrReservedAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) {
    const octets = ipv4Octets(ip)
    return octets ? isPrivateV4(octets) : true
  }
  if (kind === 6) return isPrivateV6(ip)
  return true // not an IP literal → caller must resolve first; treat as unsafe here
}

/** Validate a single URL: https, no creds, and all resolved IPs are public. Throws on failure. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('invalid_url')
  }
  if (url.protocol !== 'https:') throw new Error('scheme_not_allowed')
  if (url.username || url.password) throw new Error('credentials_not_allowed')

  const host = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets

  // If the host is already an IP literal, validate it directly. Otherwise resolve
  // every A/AAAA record and require ALL of them to be public (a host that resolves
  // to even one private address is rejected).
  if (isIP(host)) {
    if (isPrivateOrReservedAddress(host)) throw new Error('blocked_address')
    return url
  }

  let records: Array<{ address: string }>
  try {
    records = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error('dns_resolution_failed')
  }
  if (!records.length) throw new Error('dns_no_records')
  for (const r of records) {
    if (isPrivateOrReservedAddress(r.address)) throw new Error('blocked_address')
  }
  return url
}

/**
 * Fetch an image from an untrusted URL with SSRF protections, manual redirect
 * re-validation, a body-size cap, and a timeout. Throws on any violation; the
 * caller decides whether to proceed without media.
 */
export async function safeFetchImage(rawUrl: string, opts: SafeImageFetchOptions = {}): Promise<SafeImageResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = rawUrl
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const url = await assertSafeUrl(current)
      const resp = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { accept: 'image/*' } })

      // Manual redirect: re-validate the next location against the same rules.
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location')
        if (!location) throw new Error('redirect_without_location')
        if (hop === maxRedirects) throw new Error('too_many_redirects')
        current = new URL(location, url).toString()
        continue
      }
      if (!resp.ok) throw new Error(`bad_status:${resp.status}`)

      const contentType = (resp.headers.get('content-type') || '').toLowerCase()
      if (!contentType.startsWith('image/')) throw new Error(`not_image:${contentType || 'unknown'}`)

      const declared = Number(resp.headers.get('content-length') || '')
      if (Number.isFinite(declared) && declared > maxBytes) throw new Error('too_large')

      // Stream with an enforced cap (Content-Length can lie / be absent).
      if (!resp.body) throw new Error('empty_body')
      const reader = resp.body.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          total += value.byteLength
          if (total > maxBytes) {
            await reader.cancel().catch(() => {})
            throw new Error('too_large')
          }
          chunks.push(value)
        }
      }
      return { buffer: Buffer.concat(chunks), contentType, finalUrl: url.toString() }
    }
    throw new Error('too_many_redirects')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * SMS OTP delivery via Pulseem's Direct Send API (api.pulseem.com — the transactional
 * "שליחה ישירה" API, NOT the campaign ui-api). Used when the OTP method setting is 'sms'.
 * Sends from the configured sender (the WhatsApp-business / contact-us number).
 *
 * Mirrors the WhatsApp gateway path (otp.ts): in dev it echoes the OTP to the terminal; a
 * missing API key in production throws 503; a transient send failure is logged, not thrown
 * (the OTP is already stored — the user retries).
 */

/** Concise Hebrew OTP SMS body. */
export function buildOtpSmsText(otp: string): string {
  return `קוד האימות שלך לגלילו"ז: ${otp}`
}

/** Pulseem expects local Israeli numbers (0XXXXXXXXX). Convert a 972XXXXXXXXX waId. */
export function toLocalIsraeliNumber(waId: string): string {
  const digits = String(waId || '').replace(/\D/g, '')
  if (digits.startsWith('972')) return '0' + digits.slice(3)
  if (digits.startsWith('0')) return digits
  return digits
}

export async function sendOtpViaSms(waId: string, otp: string): Promise<void> {
  const config = useRuntimeConfig() as Record<string, string>
  const apiKey = config.pulseemApiKey || process.env.PULSEEM_API_KEY || ''
  const fromNumber = config.pulseemFromNumber || process.env.PULSEEM_FROM_NUMBER || ''
  const baseUrl = (config.pulseemApiUrl || process.env.PULSEEM_API_URL || 'https://api.pulseem.com').replace(/\/$/, '')

  const text = buildOtpSmsText(otp)
  const to = toLocalIsraeliNumber(waId)

  // Dev: always echo so SMS-method testing works without a real provider call.
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Auth][DEV] SMS OTP for ${waId}: ${otp}`)
  }

  if (!apiKey) {
    console.error('[Auth] CRITICAL: PULSEEM_API_KEY missing — SMS OTP not sent')
    if (process.env.NODE_ENV === 'production') {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'messaging_unavailable' })
    }
    return
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/SmsApi/SendSms`, {
      method: 'POST',
      // Auth header per the Direct Send API security scheme. (Some Pulseem docs show
      // `X-Api-Key`; if a real send returns 401, switch this header name.)
      headers: { 'Content-Type': 'application/json', APIKey: apiKey },
      body: JSON.stringify({
        isAsync: false,
        smsSendData: {
          fromNumber,
          toNumberList: [to],
          textList: [text],
        },
      }),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      console.error(`[Auth] Pulseem SMS send failed (${res.status}): ${detail}`)
    }
  } catch (err) {
    console.error('[Auth] Failed to reach Pulseem:', err instanceof Error ? err.message : String(err))
  }
}

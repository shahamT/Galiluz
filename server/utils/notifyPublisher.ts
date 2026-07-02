import { callGateway } from '~/server/utils/waGateway'

/**
 * Publisher-facing WhatsApp notices via the wa-gateway (Green API `/internal/send-message`).
 * These replaced the wa-bot's Cloud API sends: the Cloud API needs pre-approved templates to reach
 * a user who hasn't messaged in 24h, and the business isn't verified — so approval/rejection notices
 * to cold publishers silently never arrived. Green API has no 24h-window/template restriction.
 *
 * Fire-and-forget like `notifyLog`: never throws — a delivery failure must not break the
 * approve/reject/delete request that triggered it. In dev without a gateway the composed message is
 * printed to the terminal instead (like the OTP dev path).
 */

/** The message wording mirrors the wa-bot's old PUBLISHER/APPROVER consts verbatim. */
export function buildApprovedMessage(loginUrl: string): string {
  return `*את/ה מאושר/ת!* (תרתי משמע 😉)\nפרסמו את האירוע הראשון שלכם בגלילו"ז\n${loginUrl}`
}

export function buildRejectedMessage(reason?: string): string {
  const reasonLine = reason ? `\n*סיבת הדחייה:* ${reason}` : ''
  return `*לצערנו* הבקשה שלך לפרסום בגלילו"ז נדחתה... 😣${reasonLine}\n\n_ניתן לבקש אישור מחדש_`
}

export function buildEventDeletedMessage(title: string, reason: string): string {
  return `האירוע הבא נמחק על ידי מנהל\n*${title}*\nהודעה מהמנהל:\n${reason}`
}

/** The site login URL for the approved notice, from the same config key `getRpConfig` uses. */
export function getLoginUrl(): string {
  const config = useRuntimeConfig() as Record<string, any>
  const siteUrl = String(config.public?.siteUrl || 'https://galiluz.co.il').replace(/\/$/, '')
  return `${siteUrl}/login`
}

export async function notifyPublisherWhatsApp(phone: string, message: string): Promise<void> {
  if (!phone || !message) return
  const config = useRuntimeConfig() as Record<string, string>
  const gatewayUrl = (config.waGatewayUrl || process.env.WA_GATEWAY_URL || '').replace(/\/$/, '')

  if (!gatewayUrl) {
    console.info(`[notifyPublisher] WA_GATEWAY_URL unset — would send to ${phone}:\n${message}`)
    return
  }
  try {
    await callGateway('/internal/send-message', { phone, message })
  } catch (err) {
    console.error(`[notifyPublisher] gateway send to ${phone} failed:`, err instanceof Error ? err.message : String(err))
  }
}

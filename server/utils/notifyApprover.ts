/**
 * Notify the approving manager about a verified WEB registration, asking the wa-bot
 * to send the SAME Approve/Reject interactive buttons it sends for bot registrations
 * (so the approval UX is identical). Best-effort: the registration is already saved,
 * so a delivery failure is logged, never thrown. In dev (or when WA_BOT_URL is unset)
 * it just logs.
 */
export interface ApproverNotification {
  waId: string
  fullName?: string
  accountName?: string
  email?: string
  eventTypesDescription?: string
}

export async function notifyApproverOfRegistration(payload: ApproverNotification): Promise<void> {
  const config = useRuntimeConfig() as Record<string, string>
  const botUrl = (config.waBotUrl || process.env.WA_BOT_URL || '').replace(/\/$/, '')
  const apiSecret = config.apiSecret || process.env.API_SECRET || ''

  if (!botUrl) {
    console.info(`[register] WA_BOT_URL unset — approver not notified for ${payload.waId} (dev or not configured)`)
    return
  }
  try {
    await $fetch(`${botUrl}/internal/notify-approver`, {
      method: 'POST',
      headers: { 'x-api-secret': apiSecret },
      body: payload,
      timeout: 15000,
    })
  } catch (err) {
    console.error('[register] approver notify failed:', err instanceof Error ? err.message : String(err))
  }
}

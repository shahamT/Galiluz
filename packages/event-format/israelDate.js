/**
 * Israel UTC offset for date context in prompts. No dependencies.
 */
const TIMEZONE_ISRAEL = 'Asia/Jerusalem'

export function getCurrentIsraelUtcOffset() {
  const now = new Date()
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
  const israelHour = parseInt(
    new Date(utc).toLocaleString('en-US', { timeZone: TIMEZONE_ISRAEL, hour: '2-digit', hour12: false }),
    10
  )
  return israelHour - 12
}

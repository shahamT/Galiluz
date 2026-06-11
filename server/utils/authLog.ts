import { getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { getMongoConnection } from '~/server/utils/mongodb'

export type AuthAction =
  | 'otp_sent'
  | 'otp_failed'
  | 'login'
  | 'logout'
  | 'auth_failed'
  | 'blocked'
  | 'otp_request_unregistered'
  | 'publisher_rejected'

export async function logAuthEvent(
  event: H3Event,
  action: AuthAction,
  waId: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const config = useRuntimeConfig()
    const { db } = await getMongoConnection()
    const col = db.collection((config as Record<string, string>).mongodbCollectionAuthLogs || 'authLogs')
    await col.insertOne({
      timestamp: new Date(),
      action,
      waId: waId || null,
      ip: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown',
      userAgent: getHeader(event, 'user-agent') ?? '',
      ...extra,
    })
  } catch {
    // Never let logging break the auth flow
  }
}

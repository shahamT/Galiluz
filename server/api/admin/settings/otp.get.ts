import { requirePublisherAuth } from '~/server/utils/requirePublisherAuth'
import { getAppSetting } from '~/server/utils/appSettings'

/** Admin: read the OTP delivery method ('whatsapp' | 'sms'; default 'whatsapp'). Platform staff read. */
export default defineEventHandler(async (event) => {
  await requirePublisherAuth(event, { requirePlatformStaff: true })
  const doc = await getAppSetting('otp')
  return { method: doc?.method === 'sms' ? 'sms' : 'whatsapp' }
})

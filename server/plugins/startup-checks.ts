/**
 * Startup validation: fail fast if required secrets are missing in production.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const missing: string[] = []
    if (!config.otpSecret) missing.push('OTP_SECRET')
    if (!config.waCloudAccessToken) missing.push('WA_CLOUD_ACCESS_TOKEN')
    if (!config.waPhoneNumberId) missing.push('WA_PHONE_NUMBER_ID')

    if (missing.length > 0) {
      const msg = `[Startup] FATAL: Required environment variables missing: ${missing.join(', ')}. Server will not function correctly.`
      console.error(msg)
      // Throw to prevent serving traffic with broken auth
      throw new Error(msg)
    }
  }
})

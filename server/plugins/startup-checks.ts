/**
 * Startup validation: fail fast if required secrets are missing in production.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const missing: string[] = []
    if (!config.otpSecret || config.otpSecret.length < 32) missing.push('OTP_SECRET (must be at least 32 characters)')
    if (!config.apiSecret || config.apiSecret.length < 16) missing.push('API_SECRET (must be at least 16 characters)')
    if (!config.mongodbUri) missing.push('MONGODB_URI')
    if (!config.mongodbDbName) missing.push('MONGODB_DB_NAME')
    if (!config.waCloudAccessToken) missing.push('WA_CLOUD_ACCESS_TOKEN')
    if (!config.waPhoneNumberId) missing.push('WA_PHONE_NUMBER_ID')

    // Turnstile must be all-or-nothing: half-configured means either a broken
    // login (site key without server verification secret never passes) or a
    // silently unprotected endpoint (secret without a widget to issue tokens).
    const siteKey = (config.public as Record<string, string>).turnstileSiteKey
    const secretKey = config.turnstileSecretKey
    if (!!siteKey !== !!secretKey) {
      missing.push('TURNSTILE_SECRET_KEY + NUXT_PUBLIC_TURNSTILE_SITE_KEY (set both or neither)')
    } else if (!siteKey && !secretKey) {
      console.warn('[Startup] Turnstile not configured — login captcha disabled')
    }

    if (missing.length > 0) {
      const msg = `[Startup] FATAL: Required environment variables missing: ${missing.join(', ')}. Server will not function correctly.`
      console.error(msg)
      // Throw to prevent serving traffic with broken auth
      throw new Error(msg)
    }
  }
})

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * Notification mailer via Zoho SMTP (noreply@galiluz.co.il → site owner).
 * Entirely env-gated: when SMTP credentials are missing, every call no-ops
 * (one warning at first use), so dev environments need zero setup.
 * Never throws — notification email must never break a request.
 */

let transporter: Transporter | null = null
let warnedUnconfigured = false

function getMailerConfig() {
  const config = useRuntimeConfig() as Record<string, string>
  return {
    host: config.smtpHost || '',
    port: parseInt(config.smtpPort || '465', 10),
    user: config.smtpUser || '',
    pass: config.smtpPass || '',
    from: config.mailFrom || '',
    to: config.mailTo || '',
  }
}

function getTransporter(): Transporter | null {
  const { host, port, user, pass } = getMailerConfig()
  if (!host || !user || !pass) {
    if (!warnedUnconfigured) {
      console.warn('[Mailer] SMTP not configured — notification emails disabled')
      warnedUnconfigured = true
    }
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }
  return transporter
}

export async function sendNotificationMail(opts: { subject: string; text: string; html?: string }) {
  try {
    const t = getTransporter()
    if (!t) return
    const { from, to } = getMailerConfig()
    if (!from || !to) return
    await t.sendMail({
      from: `"Galiluz" <${from}>`,
      to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    })
  } catch (err) {
    console.error('[Mailer] send failed:', err instanceof Error ? err.message : err)
  }
}

import { createHmac } from 'node:crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * WebAuthn (passkey) machinery — the staff SECOND factor on top of WhatsApp OTP.
 * Wraps @simplewebauthn/server, owns rpID/origin resolution, credential (de)serialization,
 * and the short-lived MFA pre-auth token hashing. Ceremony challenges + the pre-auth token
 * are stored transiently on the publisher doc (mirrors the otp* fields in otp.ts); enrolled
 * credentials live in their own collection.
 */

export const CHALLENGE_TTL_MS = 5 * 60 * 1000   // time to complete a register/auth ceremony
export const MFA_PENDING_TTL_MS = 5 * 60 * 1000  // time to complete the passkey step after OTP

const RP_NAME = 'גלילו״ז'

export interface StoredCredential {
  publisherId: string
  credentialId: string            // base64url
  publicKey: string               // base64 of the COSE public key (string avoids BSON Binary ambiguity)
  counter: number
  transports?: AuthenticatorTransportFuture[]
  deviceName?: string
  createdAt?: Date
  lastUsedAt?: Date
}

/**
 * Pure rpID/origin derivation (no Nuxt context) — unit-tested. rpID must be the effective
 * domain and origin the full URL. Defaults: prod → derived from siteUrl; dev → localhost:3000.
 * Explicit overrides (WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN) always win.
 */
export function resolveRpConfig(opts: { rpIdOverride?: string; originOverride?: string; siteUrl?: string; isDev: boolean }): { rpID: string; origin: string; rpName: string } {
  let host = ''
  try { host = new URL(opts.siteUrl || 'https://galiluz.co.il').hostname } catch { /* keep '' */ }
  const rpID = opts.rpIdOverride || (opts.isDev ? 'localhost' : host)
  const origin = opts.originOverride || (opts.isDev ? 'http://localhost:3000' : (opts.siteUrl || `https://${host}`))
  return { rpID, origin, rpName: RP_NAME }
}

/** Relying-Party identity for the current request, from runtime config. */
export function getRpConfig(): { rpID: string; origin: string; rpName: string } {
  const config = useRuntimeConfig() as Record<string, any>
  return resolveRpConfig({
    rpIdOverride: config.webauthnRpId,
    originOverride: config.webauthnOrigin,
    siteUrl: config.public?.siteUrl,
    isDev: process.env.NODE_ENV !== 'production',
  })
}

function otpSecret(): string {
  const config = useRuntimeConfig() as Record<string, string>
  return config.otpSecret || process.env.OTP_SECRET || ''
}

/** HMAC-SHA256 of the short-lived MFA pre-auth token (only the hash is stored at rest). */
export function hashMfaToken(token: string): string {
  return createHmac('sha256', otpSecret()).update(token).digest('hex')
}

function credentialsCollection() {
  const config = useRuntimeConfig() as Record<string, string>
  return getMongoConnection().then(({ db }) =>
    db.collection(config.mongodbCollectionWebauthnCredentials || 'webauthnCredentials'),
  )
}

/** All enrolled passkeys for a publisher (newest first). */
export async function listCredentials(publisherId: string): Promise<StoredCredential[]> {
  const col = await credentialsCollection()
  const rows = await col.find({ publisherId }).sort({ createdAt: -1 }).toArray()
  return rows as unknown as StoredCredential[]
}

export async function countCredentials(publisherId: string): Promise<number> {
  const col = await credentialsCollection()
  return col.countDocuments({ publisherId })
}

// ── Registration (enroll a new passkey) ──

export async function buildRegistrationOptions(opts: { publisherId: string; userName: string; existing: StoredCredential[] }) {
  const { rpID, rpName } = getRpConfig()
  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: opts.userName,
    userID: new TextEncoder().encode(opts.publisherId),
    attestationType: 'none',
    excludeCredentials: opts.existing.map((c) => ({ id: c.credentialId, transports: c.transports })),
    // Require user verification (biometric/PIN) so the passkey itself binds possession + inherence.
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  })
}

/** Verify an enrollment attestation; returns the credential to store, or null if it failed. */
export async function verifyRegistration(opts: { response: RegistrationResponseJSON; expectedChallenge: string }) {
  const { rpID, origin } = getRpConfig()
  const verification = await verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo) return null
  const { credential } = verification.registrationInfo
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    transports: credential.transports,
  }
}

// ── Authentication (assert an existing passkey at login) ──

export async function buildAuthenticationOptions(creds: StoredCredential[]) {
  const { rpID } = getRpConfig()
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports })),
    userVerification: 'required',
  })
}

/** Verify a login assertion against a stored credential; returns the new counter, or null. */
export async function verifyAuthentication(opts: { response: AuthenticationResponseJSON; expectedChallenge: string; credential: StoredCredential }) {
  const { rpID, origin } = getRpConfig()
  const verification = await verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: opts.credential.credentialId,
      publicKey: new Uint8Array(Buffer.from(opts.credential.publicKey, 'base64')),
      counter: opts.credential.counter,
      transports: opts.credential.transports,
    },
  })
  if (!verification.verified) return null
  return { newCounter: verification.authenticationInfo.newCounter }
}

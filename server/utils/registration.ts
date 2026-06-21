/** Helpers shared by the public website registration endpoints. */

export type RegistrationPhoneStatus =
  | 'new' // no publisher with this phone (a rejected non-ghost is hard-deleted, so it lands here) → can register
  | 'already_approved' // already an approved publisher → send to login
  | 'pending_exists' // a completed registration is awaiting approval (verified web reg, or a bot reg) → block
  | 'in_progress' // a web registration was started but its phone isn't verified yet → allow resuming (resend / re-submit)
  | 'ghost_upgrade' // on-behalf ghost → allow completing a real registration

/** Classify a phone for registration eligibility from its (possibly null) publisher doc. */
export function classifyRegistrationPhone(doc: Record<string, any> | null | undefined): RegistrationPhoneStatus {
  if (!doc) return 'new'
  if (doc.status === 'approved') return 'already_approved'
  if (doc.status === 'ghost') return 'ghost_upgrade'
  if (doc.status === 'pending') {
    // A web registration that started but hasn't verified its phone is mid-flow — let the
    // registrant resume (resend / re-submit, cooldown-gated) instead of hard-blocking. Once
    // the phone is verified (awaiting approval), or for a bot registration (no phoneVerified
    // field), block a fresh registration. A rejected non-ghost is hard-deleted, so it never
    // reaches here → classified 'new' and can register again.
    return doc.phoneVerified === false ? 'in_progress' : 'pending_exists'
  }
  return 'new'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

/** Require a full name of at least two words. */
export function isTwoWordName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2
}

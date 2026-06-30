<template>
  <div class="LoginPage">
    <div class="LoginCard">
      <img src="/logos/galiluz-logo-rtl.svg" alt='גלילו"ז' class="LoginCard-logo" />

      <!-- State: phone input -->
      <template v-if="state === 'phone'">
        <h1 class="LoginCard-title">כניסה למפרסמים</h1>
        <p class="LoginCard-subtitle">הזינו את מספר הטלפון שלכם לקבלת קוד אימות בוואטסאפ</p>

        <!-- A real <form> + named tel field + submit lets the browser save the number
             for autofill on return visits (display:contents keeps the card's layout). -->
        <form class="LoginCard-form" @submit.prevent="handleSendOtp">
          <div class="LoginCard-field">
            <input
              id="phone"
              ref="phoneInput"
              v-model="phone"
              type="tel"
              name="phone"
              class="LoginCard-input"
              placeholder="05X-XXXXXXX"
              dir="ltr"
              inputmode="tel"
              autocomplete="tel"
              aria-label="מספר טלפון"
              :disabled="loading"
            />
          </div>

          <p v-if="cooldownMsg" class="LoginCard-error">{{ cooldownMsg }}</p>
          <p v-else-if="error && !notRegistered" class="LoginCard-error">{{ error }}</p>
          <p v-if="notRegistered" class="LoginCard-error">
            המספר אינו רשום כמפרסם מאושר.
            <NuxtLink to="/register" class="LoginCard-errorLink">להרשמה כמפרסם חדש</NuxtLink>
          </p>

          <p v-if="turnstileEnabled && inAppBrowser" class="LoginCard-hint">{{ OPEN_IN_BROWSER_HINT }}</p>
          <div v-show="turnstileEnabled" ref="turnstileEl" class="LoginCard-turnstile" />
          <p v-if="captchaError" class="LoginCard-error">{{ captchaError }}</p>

          <button type="submit" class="LoginCard-btn" :disabled="loading || !phone.trim() || waitingForCaptcha">
            <span v-if="loading" class="LoginCard-spinner" />
            <template v-else>שלח קוד אימות</template>
          </button>
        </form>

        <div class="LoginCard-register">
          <span class="LoginCard-registerText">עדיין לא נרשמתם כמפרסמים?</span>
          <NuxtLink to="/register" class="LoginCard-registerLink" @click="capture('publisher_register_cta_clicked', { source: 'login' })">
            לחצו כאן להרשמה מהירה!
          </NuxtLink>
        </div>
      </template>

      <!-- State: OTP input -->
      <template v-else-if="state === 'otp'">
        <h1 class="LoginCard-title">הזינו את הקוד</h1>
        <p class="LoginCard-subtitle">
          נשלח קוד בן 6 ספרות לוואטסאפ של
          <strong dir="ltr" class="LoginCard-subtitlePhone">{{ displayPhone }}</strong>
        </p>

        <FormOtpInput ref="otpInputRef" v-model="otpCode" :disabled="loading" :has-error="!!error" @complete="handleVerifyOtp" />

        <p v-if="error" class="LoginCard-error">{{ error }}</p>
        <p v-else-if="cooldownMsg" class="LoginCard-error">{{ cooldownMsg }}</p>

        <p v-if="turnstileEnabled && inAppBrowser" class="LoginCard-hint">{{ OPEN_IN_BROWSER_HINT }}</p>
        <div v-show="turnstileEnabled" ref="turnstileEl" class="LoginCard-turnstile" />
        <p v-if="captchaError" class="LoginCard-error">{{ captchaError }}</p>

        <button class="LoginCard-btn" :disabled="loading || otpCode.length < 6" @click="handleVerifyOtp">
          <span v-if="loading" class="LoginCard-spinner" />
          <template v-else>אמת קוד</template>
        </button>

        <div class="LoginCard-actions">
          <button
            class="LoginCard-linkBtn"
            :disabled="resendCountdown > 0 || waitingForCaptcha"
            @click="handleResend"
          >
            <template v-if="resendCountdown > 0">שלח שוב ({{ resendCountdown }}s)</template>
            <template v-else>שלח שוב</template>
          </button>
          <span class="LoginCard-divider" aria-hidden="true">|</span>
          <button class="LoginCard-linkBtn" @click="resetToPhone">שינוי מספר</button>
        </div>
      </template>

      <!-- State: passkey (staff second factor) -->
      <template v-else-if="state === 'passkey'">
        <h1 class="LoginCard-title">אימות דו-שלבי</h1>
        <p class="LoginCard-subtitle">אשרו את הכניסה עם מפתח הגישה שלכם — טביעת אצבע, זיהוי פנים או מפתח אבטחה.</p>

        <p v-if="passkeyError" class="LoginCard-error">{{ passkeyError }}</p>

        <button class="LoginCard-btn" :disabled="loading" @click="runPasskey">
          <span v-if="loading" class="LoginCard-spinner" />
          <template v-else>אימות עם מפתח גישה</template>
        </button>

        <div class="LoginCard-actions">
          <button class="LoginCard-linkBtn" @click="resetToPhone">חזרה</button>
        </div>
      </template>

      <!-- State: first-time staff passkey enrollment -->
      <template v-else-if="state === 'enrollPasskey'">
        <h1 class="LoginCard-title">הגדרת מפתח גישה</h1>
        <p class="LoginCard-subtitle">לחשבונות צוות נדרש מפתח גישה (Passkey) כגורם אימות שני. צרו מפתח כדי להמשיך — טביעת אצבע, זיהוי פנים או מפתח אבטחה.</p>

        <form class="LoginCard-form" @submit.prevent="createFirstPasskey">
          <div class="LoginCard-field">
            <input
              v-model="enrollName"
              type="text"
              class="LoginCard-input"
              placeholder="שם המכשיר — למשל: לפטופ עבודה"
              :disabled="loading"
              maxlength="60"
            />
          </div>

          <p v-if="enrollError" class="LoginCard-error">{{ enrollError }}</p>

          <button type="submit" class="LoginCard-btn" :disabled="loading || !enrollName.trim()">
            <span v-if="loading" class="LoginCard-spinner" />
            <template v-else>יצירת מפתח גישה</template>
          </button>
        </form>
      </template>

      <!-- State: select account (publisher in 2+ business accounts) -->
      <template v-else-if="state === 'selectAccount'">
        <h1 class="LoginCard-title">בחירת חשבון</h1>
        <p class="LoginCard-subtitle">לאיזה חשבון להיכנס?</p>

        <p v-if="selectError" class="LoginCard-error">{{ selectError }}</p>

        <ul class="LoginCard-accounts">
          <li v-for="acc in accountChoices" :key="acc.accountId">
            <button type="button" class="LoginCard-account" :disabled="loading" @click="chooseAccount(acc.accountId)">
              <img :src="acc.logo || '/logos/galiluz-icon.svg'" :alt="acc.title" class="LoginCard-accountLogo" />
              <span class="LoginCard-accountText">
                <span class="LoginCard-accountName">{{ acc.title }}</span>
                <span class="LoginCard-accountRole">{{ roleLabel(acc.role) }}</span>
              </span>
            </button>
          </li>
        </ul>
      </template>

      <!-- State: success -->
      <template v-else-if="state === 'success'">
        <div class="LoginCard-success">
          <span class="LoginCard-successIcon">✓</span>
          <h1 class="LoginCard-title">ברוך הבא!</h1>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { TURNSTILE_FAILED_MSG, OPEN_IN_BROWSER_HINT } from '~/consts/ui.const'

defineOptions({ name: 'LoginPage' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'כניסה | גלילו"ז' })

const { sendOtp, verifyOtp, verifyPasskey, registerPasskey, listMyAccounts, selectAccount, checkAuth } = useAuth()
const { capture } = usePosthog()
const authStore = useAuthStore()
const { enabled: turnstileEnabled, render: renderTurnstile, reset: resetTurnstile, remove: removeTurnstile } = useTurnstile()

// Browser autofill for a phone is unreliable on an SPA form (it never sees a real submit
// to learn the number, and only offers from a saved Addresses profile). So we remember the
// last-used number ourselves and pre-fill it on return — deterministic, device-local.
const LAST_PHONE_KEY = 'galiluz:lastPhone'

const state = ref('phone') // 'phone' | 'otp' | 'passkey' | 'enrollPasskey' | 'selectAccount' | 'success'
const phone = ref('')
const otpCode = ref('')
const otpInputRef = ref(null)
const loading = ref(false)
const error = ref('')
const notRegistered = ref(false)
// Staff second factor: options returned by verify-otp, completed in the 'passkey' state.
const mfaAuthOptions = ref(null)
const passkeyError = ref('')
// Multi-account picker: business accounts to choose from after auth (shown only when 2+).
const accountChoices = ref([])
const selectError = ref('')
// First-time staff passkey enrollment (shown when a staffer has no passkey yet).
const enrollName = ref('')
const enrollError = ref('')
const resendCountdown = ref(0)
const cooldownError = ref(false) // a send hit the 60s cooldown → show the live countdown text
let countdownTimer = null

// Live "resend in N seconds" text — ticks down with resendCountdown and clears itself at 0.
const cooldownMsg = computed(() => (cooldownError.value && resendCountdown.value > 0) ? `אפשר לשלוח קוד חדש בעוד ${resendCountdown.value} שניות` : '')

// Cloudflare Turnstile: tokens are single-use — reset after every send attempt
const turnstileEl = ref(null)
const turnstileToken = ref('')
const captchaError = ref('')    // shown next to the widget when it can't load / issue a token
const inAppBrowser = ref(false) // WhatsApp/IG/FB webview — Turnstile often can't run there
let turnstileWidgetId = null
const waitingForCaptcha = computed(() => turnstileEnabled && !turnstileToken.value)

function mountTurnstile() {
  return renderTurnstile(turnstileEl.value, {
    onToken: (token) => { turnstileToken.value = token; captchaError.value = '' },
    onExpire: () => { turnstileToken.value = '' },
    // Any terminal failure (blocked script / timeout / widget error) → guide the user
    // (unsupported browser or a blocking extension) instead of a silently-disabled button.
    onError: () => { captchaError.value = TURNSTILE_FAILED_MSG },
  })
}

// The widget shows right above each state's button. The initial phone state mounts
// it here; the watcher re-mounts it into the OTP state's element on transition (and
// back), since each state renders its own element. The success state needs none.
// Pre-fill the last-used phone (client-only; localStorage may be blocked in private mode).
onMounted(() => {
  try {
    const saved = localStorage.getItem(LAST_PHONE_KEY)
    if (saved && !phone.value) phone.value = saved
  } catch { /* localStorage unavailable — ignore */ }
  inAppBrowser.value = /FBAN|FBAV|Instagram|Line|WhatsApp|; wv\)/i.test(navigator.userAgent || '')
})

onMounted(async () => {
  if (!turnstileEnabled) return
  turnstileWidgetId = await mountTurnstile()
})

watch(state, async (s) => {
  if (!turnstileEnabled) return
  removeTurnstile(turnstileWidgetId)
  turnstileWidgetId = null
  turnstileToken.value = ''
  captchaError.value = ''
  if (s !== 'phone' && s !== 'otp') return
  await nextTick()
  turnstileWidgetId = await mountTurnstile()
})

function refreshTurnstile() {
  turnstileToken.value = ''
  resetTurnstile(turnstileWidgetId)
}

const displayPhone = computed(() => phone.value.replace(/^972/, '0'))

function parseErrorMessage(err) {
  const msg = err?.data?.message || err?.message || ''
  if (msg === 'invalid_phone') return 'מספר טלפון לא תקין'
  if (msg === 'not_registered') { notRegistered.value = true; return '' }
  if (msg.startsWith('blocked:')) {
    const secs = parseInt(msg.split(':')[1], 10)
    const mins = Math.ceil(secs / 60)
    return `המשתמש חסום. נסו שוב בעוד ${mins} דקות`
  }
  if (msg.startsWith('send_limit:')) {
    const mins = msg.split(':')[1]
    return `שלחתם יותר מדי קודים. נסו שוב בעוד ${mins} דקות`
  }
  if (msg.startsWith('resend_cooldown:')) return `אפשר לשלוח קוד חדש בעוד ${msg.split(':')[1]} שניות`
  if (msg === 'captcha_failed') return 'אימות האבטחה נכשל. נסו שוב'
  if (msg === 'captcha_unavailable') return 'שירות האבטחה אינו זמין כרגע. נסו שוב בעוד רגע'
  if (msg === 'otp_expired') return 'הקוד פג תוקף. שלחו קוד חדש'
  if (msg.startsWith('invalid_otp:')) {
    const left = msg.split(':')[1]
    return `קוד שגוי. נותרו ${left} ניסיונות`
  }
  if (msg.startsWith('blocked:')) return 'חסמנו את הכניסה לאחר מספר ניסיונות כושלים. נסו שוב בעוד 30 דקות'
  return 'שגיאה. נסו שוב'
}

function startResendCountdown(seconds = 60) {
  resendCountdown.value = seconds
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    resendCountdown.value--
    if (resendCountdown.value <= 0) clearInterval(countdownTimer)
  }, 1000)
}

async function handleSendOtp() {
  if (!phone.value.trim() || loading.value || waitingForCaptcha.value) return
  error.value = ''
  cooldownError.value = false
  loading.value = true
  try {
    await sendOtp(phone.value, turnstileToken.value)
    try { localStorage.setItem(LAST_PHONE_KEY, phone.value.trim()) } catch { /* ignore */ }
    state.value = 'otp'
    startResendCountdown()
    await nextTick()
    otpInputRef.value?.focus()
  } catch (err) {
    // Stayed on the phone state → reset the widget for a fresh token to retry.
    notRegistered.value = false
    const msg = err?.data?.message || ''
    if (msg.startsWith('resend_cooldown:')) {
      cooldownError.value = true
      startResendCountdown(parseInt(msg.split(':')[1], 10))
    } else {
      error.value = parseErrorMessage(err)
    }
    refreshTurnstile()
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resendCountdown.value > 0 || loading.value || waitingForCaptcha.value) return
  error.value = ''
  cooldownError.value = false
  loading.value = true
  try {
    await sendOtp(phone.value, turnstileToken.value)
    otpCode.value = ''
    startResendCountdown()
    await nextTick()
    otpInputRef.value?.focus()
  } catch (err) {
    const msg = err?.data?.message || ''
    if (msg.startsWith('resend_cooldown:')) {
      cooldownError.value = true
      startResendCountdown(parseInt(msg.split(':')[1], 10))
    } else {
      error.value = parseErrorMessage(err)
    }
  } finally {
    refreshTurnstile()
    loading.value = false
  }
}

const route = useRoute()

async function handleVerifyOtp() {
  if (otpCode.value.length < 6 || loading.value) return
  error.value = ''
  loading.value = true
  try {
    const res = await verifyOtp(phone.value, otpCode.value)
    // Staff with a passkey: OTP passed but no session yet — run the passkey assertion.
    if (res?.mfaRequired) {
      mfaAuthOptions.value = res.authOptions
      state.value = 'passkey'
      loading.value = false
      await nextTick()
      runPasskey() // auto-trigger the native prompt
      return
    }
    await proceedAfterAuth(res)
  } catch (err) {
    error.value = parseErrorMessage(err)
    otpCode.value = ''
    await nextTick()
    otpInputRef.value?.focus()
  } finally {
    loading.value = false
  }
}

async function runPasskey() {
  if (!mfaAuthOptions.value || loading.value) return
  passkeyError.value = ''
  loading.value = true
  try {
    const res = await verifyPasskey(mfaAuthOptions.value)
    await proceedAfterAuth(res)
  } catch {
    // Cancelled prompt / no matching authenticator / failed verification — let them retry.
    passkeyError.value = 'האימות נכשל או בוטל. נסו שוב.'
  } finally {
    loading.value = false
  }
}

// After full authentication: publishers in 2+ business accounts pick one first; everyone
// else proceeds straight to the portal. (Staff still in passkey-enrollment grace skip the
// picker — they're routed to enrollment.)
async function proceedAfterAuth(res) {
  if (res?.mfaEnrollRequired) {
    // First-time staff: enroll a passkey here (login-styled) before continuing.
    state.value = 'enrollPasskey'
    return
  }
  try {
    const accounts = await listMyAccounts()
    if (Array.isArray(accounts) && accounts.length >= 2) {
      accountChoices.value = accounts
      state.value = 'selectAccount'
      return
    }
  } catch { /* couldn't load accounts — fall through to normal navigation */ }
  state.value = 'success'
  finishLogin(res)
}

async function chooseAccount(accountId) {
  if (loading.value) return
  selectError.value = ''
  loading.value = true
  try {
    const res = await selectAccount(accountId)
    state.value = 'success'
    finishLogin(res)
  } catch {
    selectError.value = 'בחירת החשבון נכשלה. נסו שוב.'
  } finally {
    loading.value = false
  }
}

function roleLabel(role) {
  return role === 'owner' ? 'בעלים' : role === 'admin' ? 'מנהל/ת' : ''
}

// First-time staff enrollment from the login screen: create a passkey, refresh the session
// (clears mfaEnrollRequired), then enter the admin portal. Only staff ever reach this state.
async function createFirstPasskey() {
  if (!enrollName.value.trim() || loading.value) return
  enrollError.value = ''
  loading.value = true
  try {
    await registerPasskey(enrollName.value.trim())
    await checkAuth()
    state.value = 'success'
    setTimeout(() => navigateTo('/admin'), 800)
  } catch {
    enrollError.value = 'יצירת מפתח הגישה נכשלה או בוטלה. נסו שוב.'
    loading.value = false
  }
}

function finishLogin(res) {
  const returnTo = route.query.returnTo
  setTimeout(() => {
    const rt = String(returnTo || '')
    if (rt.startsWith('/') && !rt.startsWith('//') && !rt.startsWith('/\\')) {
      navigateTo(rt)
    } else {
      navigateTo(authStore.isSuperAdmin ? '/admin' : '/publisher/dashboard')
    }
  }, 800)
}

function resetToPhone() {
  state.value = 'phone'
  otpCode.value = ''
  error.value = ''
  cooldownError.value = false
  notRegistered.value = false
  mfaAuthOptions.value = null
  passkeyError.value = ''
  accountChoices.value = []
  selectError.value = ''
  enrollName.value = ''
  enrollError.value = ''
  clearInterval(countdownTimer)
  resendCountdown.value = 0
}

onUnmounted(() => {
  clearInterval(countdownTimer)
  removeTurnstile(turnstileWidgetId)
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.LoginPage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--gradient-bg-start), var(--gradient-bg-end));
  padding: var(--spacing-md);
}

.LoginCard {
  background: var(--color-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-2xl) var(--spacing-xl);
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;

  @include mobile {
    padding: var(--spacing-xl) var(--spacing-lg);
    border-radius: var(--radius-lg);
  }

  &-logo {
    height: 2.5rem;
    width: auto;
    margin-bottom: var(--spacing-xs);
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-subtitle {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-subtitlePhone {
    display: block;
    margin-top: var(--spacing-xs);
  }

  // Transparent wrapper: keeps the field/error/button as direct flex children of the
  // card (preserving gap + centering) while giving the browser a submittable form.
  &-form {
    display: contents;
  }

  &-field {
    width: 100%;
  }

  &-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-lg);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    outline: none;
    text-align: center;
    letter-spacing: 0.05em;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &:focus { border-color: var(--brand-dark-green); }
    &:disabled { opacity: 0.6; background: var(--color-surface); }
  }

  &-otpRow {
    display: flex;
    gap: var(--spacing-xs);
    justify-content: center;
  }

  &-otpBox {
    width: 2.8rem;
    height: 3.2rem;
    font-size: var(--font-size-xl);
    font-weight: 700;
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    text-align: center;
    outline: none;
    transition: border-color 0.15s;
    caret-color: transparent;

    &:focus { border-color: var(--brand-dark-green); }
    &:disabled { opacity: 0.6; background: var(--color-surface); }
    &--error { border-color: var(--color-error); }

    @include mobile {
      width: 2.5rem;
      height: 3rem;
    }
  }

  &-btn {
    width: 100%;
    padding: var(--spacing-sm-lg);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    transition: opacity 0.15s;
    min-height: 2.75rem;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }
  }

  &-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: loginSpin 0.7s linear infinite;
  }

  @keyframes loginSpin { to { transform: rotate(360deg); } }

  &-error {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: 500;
    text-align: center;
    line-height: 1.5;
  }

  &-errorLink {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--brand-dark-green);
    font-weight: 600;
    text-decoration: underline;

    &:hover { opacity: 0.8; }
  }

  // Prominent "become a publisher" CTA under the send button (phone state only)
  &-register {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    width: 100%;
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    text-align: center;
  }

  &-registerText {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-registerLink {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
    text-decoration: underline;
    padding: 0;

    &:hover { opacity: 0.85; }
  }

  &-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }

  &-divider {
    color: var(--color-border);
  }

  &-linkBtn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--brand-dark-green);
    padding: 0;
    text-decoration: underline;

    &:disabled { opacity: 0.5; cursor: not-allowed; text-decoration: none; }
  }

  &-turnstile {
    display: flex;
    justify-content: center;
    min-height: 0;

    // Cloudflare renders a fixed-size iframe; keep it from overflowing the card
    iframe { max-width: 100%; }
  }

  &-hint {
    margin: 0;
    width: 100%;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.5;
    background: var(--brand-dark-green-tint-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm);
    text-align: center;
  }

  &-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) 0;
  }

  &-successIcon {
    font-size: 3rem;
    color: var(--brand-dark-green);
  }

  &-accounts {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-account {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-background);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: start;
    font-family: var(--font-family-body);
    transition: border-color 0.15s, background 0.15s;

    &:not(:disabled):hover { border-color: var(--brand-dark-green); background: var(--brand-dark-green-tint-light); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  &-accountLogo {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-md);
    object-fit: contain;
    background: var(--color-surface);
    flex-shrink: 0;
  }

  &-accountText {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &-accountName {
    font-weight: 700;
    color: var(--brand-dark-green);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-accountRole {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }
}
</style>

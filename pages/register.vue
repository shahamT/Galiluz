<template>
  <div class="RegisterPage">
    <div class="RegisterCard">
      <img src="/logos/galiluz-logo-rtl.svg" alt='גלילו"ז' class="RegisterCard-logo" />

      <!-- Steps 1 & 2: the form -->
      <template v-if="state === 'details' || state === 'account'">
        <h1 class="RegisterCard-title">{{ REGISTER_PAGE.title }}</h1>
        <template v-if="state === 'details'">
          <p class="RegisterCard-subtitle RegisterCard-subtitle--em">{{ REGISTER_PAGE.subtitle1 }}</p>
          <p class="RegisterCard-subtitle">{{ REGISTER_PAGE.subtitle2 }}</p>
        </template>

        <div class="RegisterCard-stepHead">
          <span class="RegisterCard-stepCount">שלב {{ state === 'details' ? 1 : 2 }} מתוך 2</span>
          <span class="RegisterCard-stepTitle">{{ state === 'details' ? REGISTER_PAGE.step1Title : REGISTER_PAGE.step2Title }}</span>
        </div>

        <!-- Step 1: personal details -->
        <form v-if="state === 'details'" class="RegisterCard-form" novalidate @submit.prevent="handleNext">
          <FormField :label="REGISTER_PAGE.fullNameLabel" required :error="errors.fullName">
            <input v-model="form.fullName" type="text" class="FormInput" autocomplete="name" :disabled="loading" @input="clearError('fullName')" @blur="validateField('fullName')" />
          </FormField>
          <FormField :label="REGISTER_PAGE.emailLabel" required :error="errors.email">
            <input v-model="form.email" type="email" class="FormInput" dir="ltr" inputmode="email" autocomplete="email" :disabled="loading" @input="clearError('email')" @blur="validateField('email')" />
          </FormField>
          <FormField :label="REGISTER_PAGE.phoneLabel" required :error="errors.phone">
            <input v-model="form.phone" type="tel" class="FormInput" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="05X-XXXXXXX" :disabled="loading" @input="clearError('phone'); conflict = ''" @blur="validateField('phone')" />
          </FormField>

          <p v-if="conflict === 'already_approved'" class="RegisterCard-error">
            {{ REGISTER_PAGE.errAlreadyApproved }}
            <NuxtLink to="/login" class="RegisterCard-errorLink">{{ REGISTER_PAGE.loginLink }}</NuxtLink>
          </p>
          <p v-else-if="conflict === 'pending_exists'" class="RegisterCard-error">{{ REGISTER_PAGE.errPendingExists }}</p>
          <p v-else-if="submitError" class="RegisterCard-error">{{ submitError }}</p>

          <button type="submit" class="RegisterCard-btn" :disabled="loading || !detailsValid">
            <span v-if="loading" class="RegisterCard-spinner" />
            <template v-else>{{ REGISTER_PAGE.nextButton }}</template>
          </button>
        </form>

        <!-- Step 2: account details -->
        <form v-else class="RegisterCard-form" novalidate @submit.prevent="handleSubmit">
          <FormField :label="REGISTER_PAGE.accountNameLabel" :hint="REGISTER_PAGE.accountNameHint" required :error="errors.accountName">
            <input v-model="form.accountName" type="text" class="FormInput" :placeholder="REGISTER_PAGE.accountNamePlaceholder" :disabled="loading" @input="clearError('accountName')" @blur="validateField('accountName')" />
          </FormField>
          <FormField :label="REGISTER_PAGE.eventTypesLabel" required :error="errors.eventTypesDescription">
            <textarea v-model="form.eventTypesDescription" class="FormTextarea" rows="3" :placeholder="REGISTER_PAGE.eventTypesHint" :disabled="loading" @input="clearError('eventTypesDescription')" @blur="validateField('eventTypesDescription')" />
          </FormField>

          <label class="RegisterCard-terms">
            <input type="checkbox" v-model="form.approvedTerms" :disabled="loading" @change="clearError('terms')" />
            <span>{{ REGISTER_PAGE.termsPrefix }}<NuxtLink to="/terms-of-service" target="_blank" rel="noopener noreferrer" class="RegisterCard-termsLink">{{ REGISTER_PAGE.termsLinkText }}</NuxtLink></span>
          </label>
          <p v-if="errors.terms" class="RegisterCard-error">{{ errors.terms }}</p>
          <p v-if="cooldownMsg" class="RegisterCard-error">{{ cooldownMsg }}</p>
          <p v-else-if="submitError" class="RegisterCard-error">{{ submitError }}</p>

          <div v-show="turnstileEnabled" ref="turnstileEl" class="RegisterCard-turnstile" />

          <button type="submit" class="RegisterCard-btn" :disabled="loading || waitingForCaptcha || !accountValid">
            <span v-if="loading" class="RegisterCard-spinner" />
            <template v-else>{{ REGISTER_PAGE.submitButton }}</template>
          </button>
          <button type="button" class="RegisterCard-linkBtn" :disabled="loading" @click="state = 'details'">חזרה</button>
        </form>
      </template>

      <!-- Step 3: OTP -->
      <template v-else-if="state === 'otp'">
        <h1 class="RegisterCard-title">{{ REGISTER_PAGE.otpTitle }}</h1>
        <p class="RegisterCard-subtitle">
          {{ REGISTER_PAGE.otpSubtitle }}
          <strong dir="ltr" class="RegisterCard-subtitlePhone">{{ form.phone }}</strong>
        </p>

        <FormOtpInput ref="otpRef" v-model="otpCode" :disabled="loading" :has-error="!!otpError" @complete="handleVerify" />
        <p v-if="otpError" class="RegisterCard-error">{{ otpError }}</p>
        <p v-else-if="cooldownMsg" class="RegisterCard-error">{{ cooldownMsg }}</p>

        <div v-show="turnstileEnabled" ref="turnstileEl" class="RegisterCard-turnstile" />

        <button class="RegisterCard-btn" :disabled="loading || otpCode.length < 6" @click="handleVerify">
          <span v-if="loading" class="RegisterCard-spinner" />
          <template v-else>{{ REGISTER_PAGE.verifyButton }}</template>
        </button>

        <div class="RegisterCard-actions">
          <button class="RegisterCard-linkBtn" :disabled="resendCountdown > 0 || waitingForCaptcha || loading" @click="handleResend">
            <template v-if="resendCountdown > 0">{{ REGISTER_PAGE.resend }} ({{ resendCountdown }}s)</template>
            <template v-else>{{ REGISTER_PAGE.resend }}</template>
          </button>
          <span class="RegisterCard-divider" aria-hidden="true">|</span>
          <button class="RegisterCard-linkBtn" :disabled="loading" @click="openPhoneChange">{{ REGISTER_PAGE.changePhone }}</button>
        </div>
      </template>

      <!-- Phone change: a dedicated screen; «back» returns to the OTP screen unchanged -->
      <template v-else-if="state === 'changePhone'">
        <h1 class="RegisterCard-title">{{ REGISTER_PAGE.changePhoneTitle }}</h1>
        <p class="RegisterCard-subtitle">{{ REGISTER_PAGE.changePhoneSubtitle }}</p>

        <form class="RegisterCard-form" novalidate @submit.prevent="confirmPhoneChange">
          <FormField :label="REGISTER_PAGE.phoneLabel" required :error="phoneChangeError">
            <input v-model="newPhone" type="tel" class="FormInput" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="05X-XXXXXXX" :disabled="loading" @input="phoneChangeError = ''; conflict = ''" />
          </FormField>

          <p v-if="conflict === 'already_approved'" class="RegisterCard-error">
            {{ REGISTER_PAGE.errAlreadyApproved }}
            <NuxtLink to="/login" class="RegisterCard-errorLink">{{ REGISTER_PAGE.loginLink }}</NuxtLink>
          </p>
          <p v-else-if="conflict === 'pending_exists'" class="RegisterCard-error">{{ REGISTER_PAGE.errPendingExists }}</p>
          <p v-if="cooldownMsg" class="RegisterCard-error">{{ cooldownMsg }}</p>

          <div v-show="turnstileEnabled" ref="turnstileEl" class="RegisterCard-turnstile" />

          <button type="submit" class="RegisterCard-btn" :disabled="loading || waitingForCaptcha || !newPhoneValid">
            <span v-if="loading" class="RegisterCard-spinner" />
            <template v-else>{{ REGISTER_PAGE.changePhoneConfirm }}</template>
          </button>
          <button type="button" class="RegisterCard-linkBtn" :disabled="loading" @click="cancelPhoneChange">{{ REGISTER_PAGE.changePhoneBack }}</button>
        </form>
      </template>

      <!-- Step 4: success -->
      <template v-else-if="state === 'success'">
        <div class="RegisterCard-success">
          <span class="RegisterCard-successIcon">✓</span>
          <h1 class="RegisterCard-title">{{ REGISTER_PAGE.successTitle }}</h1>
          <p class="RegisterCard-subtitle">{{ REGISTER_PAGE.successBody }}</p>
        </div>
        <button class="RegisterCard-btn" @click="navigateTo('/')">{{ REGISTER_PAGE.backToSchedule }}</button>
      </template>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'RegisterPage' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'הצטרפות כמפרסמים | גלילו"ז' })

import { REGISTER_PAGE } from '~/consts/ui.const'

const { checkPhone, startRegistration, verifyRegistration } = useRegister()
const { enabled: turnstileEnabled, render: renderTurnstile, reset: resetTurnstile, remove: removeTurnstile } = useTurnstile()
const { capture } = usePosthog()

const state = ref('details') // 'details' | 'account' | 'otp' | 'success'
const form = reactive({ fullName: '', email: '', phone: '', accountName: '', eventTypesDescription: '', approvedTerms: false })
const errors = reactive({ fullName: '', email: '', phone: '', accountName: '', eventTypesDescription: '', terms: '' })
const loading = ref(false)
const submitError = ref('')
const conflict = ref('') // '' | 'already_approved' | 'pending_exists'
const otpCode = ref('')
const otpError = ref('')
const otpRef = ref(null)
const newPhone = ref('') // edited on the dedicated change-phone screen; committed to form.phone only after a successful resend
const phoneChangeError = ref('')
const resendCountdown = ref(0)
const cooldownError = ref(false) // a send hit the 60s cooldown → show the live countdown text
let countdownTimer = null

// Turnstile (single shared widget; the OTP send is the paid action)
const turnstileEl = ref(null)
const turnstileToken = ref('')
let turnstileWidgetId = null
const waitingForCaptcha = computed(() => turnstileEnabled && !turnstileToken.value)

function mountTurnstile() {
  return renderTurnstile(turnstileEl.value, {
    onToken: (token) => { turnstileToken.value = token },
    onExpire: () => { turnstileToken.value = '' },
    onError: (code) => {
      if (String(code).startsWith('110')) submitError.value = 'אימות האבטחה אינו זמין כרגע. נסו שוב מאוחר יותר.'
    },
  })
}

// The widget is needed on every step that sends an OTP — account (first send), otp
// (resend), and changePhone (send to a new number) — and shows right above each
// step's button. Each step renders its own element, so tear down the single widget
// and (re)mount it into whichever element is now in the DOM. Details/success need none.
watch(state, async (s) => {
  if (!turnstileEnabled) return
  removeTurnstile(turnstileWidgetId)
  turnstileWidgetId = null
  turnstileToken.value = ''
  if (s !== 'account' && s !== 'otp' && s !== 'changePhone') return
  await nextTick()
  turnstileWidgetId = await mountTurnstile()
})

function refreshTurnstile() {
  turnstileToken.value = ''
  resetTurnstile(turnstileWidgetId)
}

function clearError(k) { errors[k] = '' }

// Single source of truth for validity — drives both blur errors and the live
// button-enable state (so a button is disabled until its step fully validates).
const FIELD_MESSAGES = {
  fullName: 'נא להזין שם פרטי ושם משפחה',
  email: 'כתובת אימייל לא תקינה',
  phone: 'מספר טלפון לא תקין',
  accountName: 'נא למלא שם חשבון',
  eventTypesDescription: 'נא לתאר את האירועים',
  terms: 'יש לאשר את תנאי השימוש',
}
function fieldIsValid(key) {
  switch (key) {
    case 'fullName': return form.fullName.trim().split(/\s+/).filter(Boolean).length >= 2
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    case 'phone': return form.phone.replace(/\D/g, '').length >= 9
    case 'accountName': return !!form.accountName.trim()
    case 'eventTypesDescription': return !!form.eventTypesDescription.trim()
    case 'terms': return !!form.approvedTerms
    default: return true
  }
}

// Per-field validation — run on blur (and from the aggregate checks on submit).
function validateField(key) {
  errors[key] = fieldIsValid(key) ? '' : (FIELD_MESSAGES[key] || '')
}

const detailsValid = computed(() => fieldIsValid('fullName') && fieldIsValid('email') && fieldIsValid('phone'))
const accountValid = computed(() => fieldIsValid('accountName') && fieldIsValid('eventTypesDescription') && fieldIsValid('terms'))
const newPhoneValid = computed(() => newPhone.value.replace(/\D/g, '').length >= 9)
// Live "resend in N seconds" text — ticks down with resendCountdown and clears itself at 0.
const cooldownMsg = computed(() => (cooldownError.value && resendCountdown.value > 0) ? `אפשר לשלוח קוד חדש בעוד ${resendCountdown.value} שניות` : '')

function validateDetails() {
  validateField('fullName')
  validateField('email')
  validateField('phone')
  return detailsValid.value
}
function validateAccount() {
  validateField('accountName')
  validateField('eventTypesDescription')
  validateField('terms')
  return accountValid.value
}

function parseError(err) {
  const msg = err?.data?.message || err?.message || ''
  if (msg === 'invalid_phone') return 'מספר טלפון לא תקין'
  if (msg === 'invalid_name') return 'נא להזין שם פרטי ושם משפחה'
  if (msg === 'invalid_email') return 'כתובת אימייל לא תקינה'
  if (msg === 'invalid_account_name') return 'נא למלא שם חשבון'
  if (msg === 'invalid_description') return 'נא לתאר את האירועים'
  if (msg === 'terms_required') return 'יש לאשר את תנאי השימוש'
  if (msg === 'pending_exists') return REGISTER_PAGE.errPendingExists
  if (msg === 'otp_expired') return 'הקוד פג תוקף. שלחו קוד חדש'
  if (msg.startsWith('invalid_otp:')) return `קוד שגוי. נותרו ${msg.split(':')[1]} ניסיונות`
  if (msg.startsWith('blocked:')) {
    const mins = Math.ceil(parseInt(msg.split(':')[1], 10) / 60)
    return `חסום זמנית. נסו שוב בעוד ${mins} דקות`
  }
  if (msg.startsWith('send_limit:')) return `שלחתם יותר מדי קודים. נסו שוב בעוד ${msg.split(':')[1]} דקות`
  if (msg.startsWith('resend_cooldown:')) return `אפשר לשלוח קוד חדש בעוד ${msg.split(':')[1]} שניות`
  return 'שגיאה. נסו שוב מאוחר יותר'
}

function startResendCountdown(seconds = 60) {
  resendCountdown.value = seconds
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    resendCountdown.value--
    if (resendCountdown.value <= 0) clearInterval(countdownTimer)
  }, 1000)
}

async function handleNext() {
  conflict.value = ''
  submitError.value = ''
  if (!validateDetails()) return
  loading.value = true
  try {
    const { status } = await checkPhone(form.phone)
    if (status === 'already_approved') { conflict.value = 'already_approved'; return }
    if (status === 'pending_exists') { conflict.value = 'pending_exists'; return } // verified, awaiting approval
    // 'in_progress' (own unverified registration), ghost, or new → proceed; step 2 resends (cooldown-gated).
    capture('publisher_register_started', {})
    state.value = 'account'
  } catch (err) {
    submitError.value = parseError(err)
  } finally {
    loading.value = false
  }
}

function startPayload() {
  return {
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
    accountName: form.accountName,
    eventTypesDescription: form.eventTypesDescription,
    approvedTerms: form.approvedTerms,
    turnstileToken: turnstileToken.value,
  }
}

async function handleSubmit() {
  submitError.value = ''
  conflict.value = ''
  cooldownError.value = false
  if (!validateAccount() || waitingForCaptcha.value) return
  loading.value = true
  try {
    await startRegistration(startPayload())
    capture('publisher_register_submitted', {})
    otpCode.value = ''
    state.value = 'otp'
    startResendCountdown()
    await nextTick()
    otpRef.value?.focus()
  } catch (err) {
    const msg = err?.data?.message || ''
    if (msg === 'already_approved' || msg === 'pending_exists') {
      // Approved (→ login) or awaiting approval → back to step 1 with the message; watcher tears the widget down.
      conflict.value = msg
      state.value = 'details'
    } else if (msg.startsWith('resend_cooldown:')) {
      // Too soon since the last send → live countdown (no static error); reset the widget.
      cooldownError.value = true
      startResendCountdown(parseInt(msg.split(':')[1], 10))
      refreshTurnstile()
    } else {
      // Stayed on the account step → reset the widget for a fresh token to retry.
      submitError.value = parseError(err)
      refreshTurnstile()
    }
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resendCountdown.value > 0 || loading.value || waitingForCaptcha.value) return
  otpError.value = ''
  cooldownError.value = false
  loading.value = true
  try {
    await startRegistration(startPayload())
    otpCode.value = ''
    startResendCountdown()
    await nextTick()
    otpRef.value?.focus()
  } catch (err) {
    const msg = err?.data?.message || ''
    if (msg.startsWith('resend_cooldown:')) {
      cooldownError.value = true
      startResendCountdown(parseInt(msg.split(':')[1], 10))
    } else {
      otpError.value = parseError(err)
    }
  } finally {
    refreshTurnstile()
    loading.value = false
  }
}

async function handleVerify() {
  if (otpCode.value.length < 6 || loading.value) return
  otpError.value = ''
  loading.value = true
  try {
    await verifyRegistration(form.phone, otpCode.value)
    capture('publisher_register_verified', {})
    state.value = 'success'
  } catch (err) {
    otpError.value = parseError(err)
    otpCode.value = ''
    await nextTick()
    otpRef.value?.focus()
  } finally {
    loading.value = false
  }
}

function openPhoneChange() {
  newPhone.value = form.phone
  phoneChangeError.value = ''
  conflict.value = ''
  cooldownError.value = false
  state.value = 'changePhone'
}

function cancelPhoneChange() {
  // Decided not to change after all — back to the OTP screen, number & code untouched.
  phoneChangeError.value = ''
  conflict.value = ''
  cooldownError.value = false
  state.value = 'otp'
}

async function confirmPhoneChange() {
  phoneChangeError.value = ''
  conflict.value = ''
  cooldownError.value = false
  if (!newPhoneValid.value) { phoneChangeError.value = 'מספר טלפון לא תקין'; return }
  if (waitingForCaptcha.value) return
  loading.value = true
  try {
    // Same conflict validation as step 1: an approved/pending number is rejected here too.
    const { status } = await checkPhone(newPhone.value)
    if (status === 'already_approved') { conflict.value = 'already_approved'; return }
    if (status === 'pending_exists') { conflict.value = 'pending_exists'; return } // verified, awaiting approval
    // 'in_progress'/ghost/new → allow; the OTP goes to that phone and is cooldown-gated.
    // Send a fresh OTP to the new number; commit it to the form only once the send succeeds.
    await startRegistration({ ...startPayload(), phone: newPhone.value })
    form.phone = newPhone.value
    otpCode.value = ''
    otpError.value = ''
    state.value = 'otp'
    startResendCountdown()
    await nextTick()
    otpRef.value?.focus()
  } catch (err) {
    const msg = err?.data?.message || ''
    if (msg === 'already_approved' || msg === 'pending_exists') conflict.value = msg
    else if (msg.startsWith('resend_cooldown:')) { cooldownError.value = true; startResendCountdown(parseInt(msg.split(':')[1], 10)) }
    else phoneChangeError.value = parseError(err)
    refreshTurnstile() // stayed on the change screen → fresh token for the next attempt
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  clearInterval(countdownTimer)
  removeTurnstile(turnstileWidgetId)
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.RegisterPage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--gradient-bg-start), var(--gradient-bg-end));
  padding: var(--spacing-md);

  @include mobile {
    padding: 0;
  }
}

.RegisterCard {
  background: var(--color-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-2xl) var(--spacing-xl);
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;

  @include mobile {
    // Full-screen on mobile (login stays a card; registration fills the viewport).
    max-width: none;
    min-height: 100dvh;
    border-radius: 0;
    box-shadow: none;
    justify-content: flex-start;
    padding: var(--spacing-xl) var(--spacing-lg);
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

    &--em { font-weight: 600; }
  }

  &-subtitlePhone {
    display: block;
    margin-top: var(--spacing-xs);
  }

  &-stepHead {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: right;
    margin-top: var(--spacing-sm);
  }

  &-stepCount {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-weight: 600;
  }

  &-stepTitle {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text);
  }

  // Full-width form area; fields read RTL while the card centers the headings.
  &-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    text-align: right;
  }

  &-terms {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    cursor: pointer;
    text-align: right;

    input { margin-top: 0.2rem; flex-shrink: 0; }
  }

  &-termsLink {
    color: var(--brand-dark-green);
    font-weight: 600;
    text-decoration: underline;
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
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: registerSpin 0.7s linear infinite;
  }

  @keyframes registerSpin { to { transform: rotate(360deg); } }

  &-error {
    margin: 0;
    width: 100%;
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: 500;
    line-height: 1.5;
  }

  &-errorLink {
    display: inline-block;
    margin-top: var(--spacing-xs);
    color: var(--brand-dark-green);
    font-weight: 600;
    text-decoration: underline;

    &:hover { opacity: 0.8; }
  }

  &-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }

  &-divider { color: var(--color-border); }

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
    iframe { max-width: 100%; }
  }

  &-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) 0;
  }

  &-successIcon {
    font-size: 3rem;
    color: var(--brand-dark-green);
  }
}
</style>

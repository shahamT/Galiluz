<template>
  <div class="LoginPage">
    <div class="LoginCard">
      <img src="/logos/galiluz-logo-rtl.svg" alt='גלילו"ז' class="LoginCard-logo" />

      <!-- State: phone input -->
      <template v-if="state === 'phone'">
        <h1 class="LoginCard-title">כניסה למפרסמים</h1>
        <p class="LoginCard-subtitle">הזינו את מספר הטלפון שלכם לקבלת קוד אימות בוואטסאפ</p>

        <div class="LoginCard-field">
          <input
            ref="phoneInput"
            v-model="phone"
            type="tel"
            class="LoginCard-input"
            placeholder="05X-XXXXXXX"
            dir="ltr"
            inputmode="tel"
            autocomplete="tel"
            :disabled="loading"
            @keydown.enter="handleSendOtp"
          />
        </div>

        <p v-if="error && !notRegistered" class="LoginCard-error">{{ error }}</p>
        <p v-if="notRegistered" class="LoginCard-error">
          המספר אינו רשום כמפרסם מאושר.
          <a :href="PUBLISH_EVENT_WHATSAPP_LINK" target="_blank" rel="noopener noreferrer" class="LoginCard-errorLink">לחצו כאן להרשמה דרך הבוט</a>
        </p>

        <button class="LoginCard-btn" :disabled="loading || !phone.trim()" @click="handleSendOtp">
          <span v-if="loading" class="LoginCard-spinner" />
          <template v-else>שלח קוד אימות</template>
        </button>
      </template>

      <!-- State: OTP input -->
      <template v-else-if="state === 'otp'">
        <h1 class="LoginCard-title">הזינו את הקוד</h1>
        <p class="LoginCard-subtitle">
          נשלח קוד בן 6 ספרות לוואטסאפ של
          <strong dir="ltr">{{ displayPhone }}</strong>
        </p>

        <div class="LoginCard-otpRow" dir="ltr">
          <input
            v-for="(_, i) in 6"
            :key="i"
            :ref="(el) => { if (el) otpInputs[i] = el }"
            v-model="otpDigits[i]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="LoginCard-otpBox"
            :class="{ 'LoginCard-otpBox--error': !!error }"
            :disabled="loading"
            @keydown="(e) => handleOtpKeydown(e, i)"
            @input="(e) => handleOtpInput(e, i)"
            @paste.prevent="handleOtpPaste"
          />
        </div>

        <p v-if="error" class="LoginCard-error">{{ error }}</p>

        <button class="LoginCard-btn" :disabled="loading || otpCode.length < 6" @click="handleVerifyOtp">
          <span v-if="loading" class="LoginCard-spinner" />
          <template v-else>אמת קוד</template>
        </button>

        <div class="LoginCard-actions">
          <button
            class="LoginCard-linkBtn"
            :disabled="resendCountdown > 0"
            @click="handleResend"
          >
            <template v-if="resendCountdown > 0">שלח שוב ({{ resendCountdown }}s)</template>
            <template v-else>שלח שוב</template>
          </button>
          <span class="LoginCard-divider" aria-hidden="true">|</span>
          <button class="LoginCard-linkBtn" @click="resetToPhone">שינוי מספר</button>
        </div>
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
defineOptions({ name: 'LoginPage' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'כניסה | גלילו"ז' })

import { PUBLISH_EVENT_WHATSAPP_LINK } from '~/consts/ui.const'

const { sendOtp, verifyOtp } = useAuth()
const authStore = useAuthStore()

const state = ref('phone') // 'phone' | 'otp' | 'success'
const phone = ref('')
const otpDigits = ref(Array(6).fill(''))
const otpInputs = ref([])
const loading = ref(false)
const error = ref('')
const notRegistered = ref(false)
const resendCountdown = ref(0)
let countdownTimer = null

const otpCode = computed(() => otpDigits.value.join(''))
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
  if (!phone.value.trim() || loading.value) return
  error.value = ''
  loading.value = true
  try {
    await sendOtp(phone.value)
    state.value = 'otp'
    startResendCountdown()
    await nextTick()
    otpInputs.value[0]?.focus()
  } catch (err) {
    notRegistered.value = false
    error.value = parseErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resendCountdown.value > 0 || loading.value) return
  error.value = ''
  loading.value = true
  try {
    await sendOtp(phone.value)
    otpDigits.value = Array(6).fill('')
    startResendCountdown()
    await nextTick()
    otpInputs.value[0]?.focus()
  } catch (err) {
    error.value = parseErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const route = useRoute()

async function handleVerifyOtp() {
  if (otpCode.value.length < 6 || loading.value) return
  error.value = ''
  loading.value = true
  try {
    await verifyOtp(phone.value, otpCode.value)
    state.value = 'success'
    const returnTo = route.query.returnTo
    setTimeout(() => {
      if (returnTo && String(returnTo).startsWith('/')) {
        navigateTo(returnTo)
      } else {
        navigateTo(authStore.isManager ? '/admin' : '/publisher/dashboard')
      }
    }, 800)
  } catch (err) {
    error.value = parseErrorMessage(err)
    otpDigits.value = Array(6).fill('')
    await nextTick()
    otpInputs.value[0]?.focus()
  } finally {
    loading.value = false
  }
}

function handleOtpInput(e, index) {
  const val = e.target?.value?.replace(/\D/g, '').slice(-1) || ''
  otpDigits.value[index] = val
  if (val && index < 5) {
    nextTick(() => otpInputs.value[index + 1]?.focus())
  }
  // Auto-submit is only triggered via handleOtpPaste to avoid double-submit on paste
}

function handleOtpKeydown(e, index) {
  if (e.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    nextTick(() => otpInputs.value[index - 1]?.focus())
  }
}

function handleOtpPaste(e) {
  const text = e.clipboardData?.getData('text') || ''
  const digits = text.replace(/\D/g, '').slice(0, 6).split('')
  digits.forEach((d, i) => { otpDigits.value[i] = d })
  nextTick(() => {
    const focusIdx = Math.min(digits.length, 5)
    otpInputs.value[focusIdx]?.focus()
    if (digits.length === 6) handleVerifyOtp()
  })
}

function resetToPhone() {
  state.value = 'phone'
  otpDigits.value = Array(6).fill('')
  error.value = ''
  notRegistered.value = false
  clearInterval(countdownTimer)
  resendCountdown.value = 0
}

onUnmounted(() => clearInterval(countdownTimer))
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
}
</style>

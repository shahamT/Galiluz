<template>
  <div class="EnrollPasskey">
    <div class="EnrollPasskey-card">
      <img src="/logos/galiluz-logo-rtl.svg" alt="גלילו״ז" class="EnrollPasskey-logo" />
      <h1 class="EnrollPasskey-title">הוספת מפתח גישה למכשיר זה</h1>

      <p v-if="state === 'loading'" class="EnrollPasskey-muted">בודק את הקישור…</p>

      <template v-else-if="state === 'error'">
        <p class="EnrollPasskey-error">{{ errorMsg }}</p>
        <p class="EnrollPasskey-muted">צרו קישור חדש מהמכשיר שכבר מחובר (הגדרות ← אבטחה ← הוספת מכשיר נוסף).</p>
      </template>

      <template v-else-if="state === 'success'">
        <div class="EnrollPasskey-check" aria-hidden="true">✓</div>
        <p class="EnrollPasskey-lead">המכשיר נוסף בהצלחה!</p>
        <p class="EnrollPasskey-muted">
          אפשר עכשיו להתחבר מהמכשיר הזה: הזינו את מספר הטלפון, את קוד ה-OTP, ואז אשרו עם מפתח הגישה החדש.
        </p>
        <NuxtLink to="/login" class="EnrollPasskey-btn EnrollPasskey-btn--link">מעבר לכניסה</NuxtLink>
      </template>

      <template v-else>
        <p class="EnrollPasskey-lead">
          הוסיפו מפתח גישה (טביעת אצבע / זיהוי פנים) למכשיר הזה<template v-if="label"> עבור {{ label }}</template>.
        </p>
        <input
          v-model="deviceName"
          type="text"
          class="EnrollPasskey-input"
          placeholder="שם המכשיר (לא חובה) — למשל: אייפון"
          :disabled="state === 'enrolling'"
          maxlength="60"
        />
        <button class="EnrollPasskey-btn" :disabled="state === 'enrolling'" @click="enroll">
          <span v-if="state === 'enrolling'" class="EnrollPasskey-spinner" />
          <template v-else>הוספת מפתח גישה</template>
        </button>
        <p v-if="errorMsg" class="EnrollPasskey-error">{{ errorMsg }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * Public cross-device passkey enrollment. Opened on a NEW device via a short-lived, single-use link
 * (?t=…) generated from an already-authenticated device. The token authorizes registering THIS
 * device's own local passkey — it never grants a session (login still needs OTP). See
 * server/api/auth/passkey/enroll-{options,verify}.
 */
defineOptions({ name: 'EnrollPasskey' })
definePageMeta({ layout: false })

const route = useRoute()
const token = String(route.query.t || '')

const state = ref('loading') // loading | ready | enrolling | success | error
const label = ref('')
const errorMsg = ref('')
const deviceName = ref('')
let regOptions = null

usePageSeo({ title: 'הוספת מפתח גישה' })
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

onMounted(async () => {
  if (!token) {
    state.value = 'error'
    errorMsg.value = 'קישור לא תקין.'
    return
  }
  try {
    const res = await $fetch('/api/auth/passkey/enroll-options', { method: 'POST', body: { token } })
    regOptions = res.options
    label.value = res.label || ''
    state.value = 'ready'
  } catch {
    state.value = 'error'
    errorMsg.value = 'הקישור אינו תקין או שפג תוקפו.'
  }
})

async function enroll() {
  if (state.value === 'enrolling') return
  errorMsg.value = ''
  state.value = 'enrolling'
  try {
    const { startRegistration } = await import('@simplewebauthn/browser')
    const attestation = await startRegistration({ optionsJSON: regOptions })
    await $fetch('/api/auth/passkey/enroll-verify', {
      method: 'POST',
      body: { token, response: attestation, deviceName: deviceName.value.trim() },
    })
    state.value = 'success'
  } catch (err) {
    const msg = err?.data?.message
    if (msg === 'already_enrolled') errorMsg.value = 'מכשיר זה כבר רשום בחשבון.'
    else if (msg === 'invalid_token') errorMsg.value = 'הקישור פג תוקף. צרו קישור חדש מהמכשיר המחובר.'
    else if (msg === 'challenge_expired') errorMsg.value = 'עבר יותר מדי זמן. פתחו שוב את הקישור ונסו מיד.'
    else errorMsg.value = 'ההוספה בוטלה או נכשלה. ודאו שהמכשיר תומך במפתחות גישה ונסו שוב.'
    state.value = 'ready'
  }
}
</script>

<style lang="scss">
.EnrollPasskey {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  direction: rtl;
  font-family: var(--font-family-rubik);
  background-color: var(--app-bg-base);
  background-image: var(--app-bg);

  &-card {
    width: 100%;
    max-width: 26rem;
    background: #fff;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl);
    box-shadow: 0 22px 60px -30px rgba(30, 90, 70, 0.4);
    text-align: center;
  }

  &-logo { height: 34px; width: auto; margin: 0 auto var(--spacing-lg); display: block; }

  &-title {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-lead { margin: 0 0 var(--spacing-md); font-size: var(--font-size-base); color: var(--color-text); line-height: 1.5; }
  &-muted { margin: var(--spacing-sm) 0 0; color: var(--color-text-light); font-size: var(--font-size-sm); line-height: 1.5; }
  &-error { margin: var(--spacing-md) 0 0; color: var(--color-error); font-weight: 600; }

  &-check {
    width: 3rem; height: 3rem; margin: 0 auto var(--spacing-md);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.5rem; font-weight: 800; color: #fff;
    background: var(--brand-dark-green); border-radius: 50%;
  }

  &-input {
    width: 100%;
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    outline: none;
    &:focus { border-color: var(--brand-dark-green); }
  }

  &-btn {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-base);
    font-family: var(--font-family-rubik);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    text-decoration: none;
    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &--link { margin-top: var(--spacing-lg); }
  }

  &-spinner {
    width: 1rem; height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: enrollSpin 0.7s linear infinite;
  }
  @keyframes enrollSpin { to { transform: rotate(360deg); } }
}
</style>

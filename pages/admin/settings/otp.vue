<template>
  <div class="OtpSettings">
    <!-- Mobile drill-in: back to the settings list -->
    <NuxtLink to="/admin/settings" class="OtpSettings-back">
      <UiIcon name="arrow_forward" size="sm" />
      חזרה להגדרות
    </NuxtLink>

    <header class="OtpSettings-header">
      <h1 class="OtpSettings-title">שיטת שליחת קוד אימות (OTP)</h1>
      <p class="OtpSettings-desc">בחרו כיצד יישלח קוד האימות לכניסה ולהרשמה. ברירת המחדל היא וואטסאפ.</p>
    </header>

    <section class="OtpSettings-card">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="OtpSettings-option"
        :class="{ 'OtpSettings-option--active': method === opt.value }"
        :disabled="saving"
        @click="select(opt.value)"
      >
        <UiIcon :name="opt.icon" size="md" class="OtpSettings-optionIcon" />
        <span class="OtpSettings-optionText">
          <span class="OtpSettings-optionLabel">{{ opt.label }}</span>
          <span class="OtpSettings-optionHint">{{ opt.hint }}</span>
        </span>
        <UiIcon v-if="method === opt.value" name="check_circle" size="sm" class="OtpSettings-check" />
      </button>

      <p v-if="error" class="OtpSettings-error">{{ error }}</p>
    </section>

    <p class="OtpSettings-note">
      שליחה ב-SMS דורשת הגדרת מפתח Pulseem ומספר שולח (משתני סביבה) בשרת. עד שאלו מוגדרים, השאירו על וואטסאפ.
    </p>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsOtp' })

const options = [
  { value: 'whatsapp', label: 'וואטסאפ', hint: 'שליחת הקוד דרך חשבון הוואטסאפ העסקי (ברירת מחדל).', icon: 'chat' },
  { value: 'sms', label: 'SMS', hint: 'שליחת הקוד כהודעת SMS דרך Pulseem, מאותו מספר.', icon: 'sms' },
]

const method = ref('whatsapp')
const saving = ref(false)
const error = ref('')

async function load() {
  try {
    const res = await $fetch('/api/admin/settings/otp')
    method.value = res?.method === 'sms' ? 'sms' : 'whatsapp'
  } catch (err) {
    console.error('[otp-settings] load failed', err)
  }
}

async function select(next) {
  if (saving.value || next === method.value) return
  error.value = ''
  saving.value = true
  const prev = method.value
  method.value = next // optimistic
  try {
    await $fetch('/api/admin/settings/otp', { method: 'POST', body: { method: next } })
  } catch (err) {
    method.value = prev // revert on failure
    error.value = 'שמירת ההגדרה נכשלה. נסו שוב.'
    console.error('[otp-settings] save failed', err)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.OtpSettings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &-back {
    display: none;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--brand-dark-green);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 600;
    @include mobile { display: inline-flex; }
  }

  &-header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-title { margin: 0; font-size: var(--font-size-xl); font-weight: 700; color: var(--brand-dark-green); }
  &-desc { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); line-height: 1.6; }

  &-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
    padding: var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    text-align: start;
    font-family: var(--font-family-body);
    transition: border-color 0.15s, background 0.15s;

    &:not(:disabled):hover { border-color: var(--brand-dark-green); }
    &:disabled { opacity: 0.6; cursor: default; }

    &--active {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
    }
  }

  &-optionIcon { color: var(--brand-dark-green); flex-shrink: 0; }
  &-optionText { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  &-optionLabel { font-weight: 700; color: var(--color-text); }
  &-optionHint { font-size: var(--font-size-sm); color: var(--color-text-light); }
  &-check { color: var(--brand-dark-green); flex-shrink: 0; }

  &-error { margin: 0; color: var(--color-error); font-weight: 500; font-size: var(--font-size-sm); }
  &-note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); line-height: 1.6; }
}
</style>

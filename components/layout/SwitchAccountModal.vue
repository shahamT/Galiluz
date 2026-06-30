<template>
  <Teleport to="body">
    <div class="SwitchAccountModal-overlay" @click.self="emit('close')">
      <div class="SwitchAccountModal">
        <div class="SwitchAccountModal-header">
          <div>
            <h2 class="SwitchAccountModal-title">החלפת חשבון</h2>
            <p class="SwitchAccountModal-subtitle">לאן להיכנס?</p>
          </div>
          <button type="button" class="SwitchAccountModal-close" aria-label="סגור" @click="emit('close')">
            <UiIcon name="close" size="sm" />
          </button>
        </div>

        <div class="SwitchAccountModal-body">
          <p v-if="error" class="SwitchAccountModal-error">{{ error }}</p>

          <ul class="SwitchAccountModal-accounts">
            <li v-for="acc in choices" :key="acc.accountId">
              <button
                type="button"
                class="SwitchAccountModal-account"
                :class="{ 'SwitchAccountModal-account--current': acc.current }"
                :disabled="busy"
                @click="choose(acc)"
              >
                <img :src="acc.logo" :alt="acc.title" class="SwitchAccountModal-accountLogo" />
                <span class="SwitchAccountModal-accountText">
                  <span class="SwitchAccountModal-accountName">{{ acc.title }}</span>
                  <span class="SwitchAccountModal-accountRole">{{ acc.roleLabel }}</span>
                </span>
                <span v-if="acc.current" class="SwitchAccountModal-badge">נוכחי</span>
                <UiIcon
                  v-else-if="busy && selectingId === acc.accountId"
                  name="progress_activity"
                  size="sm"
                  class="SwitchAccountModal-spinner"
                />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'LayoutSwitchAccountModal' })

const props = defineProps({
  businessAccounts: { type: Array, default: () => [] },
})
const emit = defineEmits(['close'])

const authStore = useAuthStore()
const route = useRoute()
const { selectAccount } = useAuth()

const busy = ref(false)
const selectingId = ref('')
const error = ref('')

// Same choice list as the login picker: the user's business account(s) plus, for platform
// staff, the management portal. The current context is flagged so it renders as non-actionable.
const choices = computed(() => {
  const onAdmin = route.path.startsWith('/admin')
  const list = (props.businessAccounts || []).map(a => ({
    kind: 'business',
    accountId: a.accountId,
    title: a.title,
    logo: a.logo || '/logos/galiluz-icon.svg',
    roleLabel: a.role === 'owner' ? 'בעלים' : 'מנהל/ת',
    current: !onAdmin && a.accountId === authStore.user?.activeAccountId,
  }))

  if (authStore.isPlatformStaff) {
    const pr = authStore.user?.platformRole
    list.push({
      kind: 'admin',
      accountId: '__admin__',
      title: 'ניהול הפלטפורמה',
      logo: '/logos/galiluz-icon.svg',
      roleLabel: pr === 'platform_owner' ? 'בעלים' : pr === 'viewer' ? 'צפייה בלבד' : 'סופר אדמין',
      current: onAdmin,
    })
  }
  return list
})

async function choose(choice) {
  if (busy.value) return
  if (choice.current) { emit('close'); return }

  error.value = ''
  busy.value = true
  selectingId.value = choice.accountId
  try {
    if (choice.kind === 'admin') {
      // Enter the management portal; the active business account is left unchanged.
      window.location.href = '/admin'
      return
    }
    await selectAccount(choice.accountId)
    // Hard reload so every account-scoped store/fetch re-runs cleanly under the new context.
    window.location.href = '/publisher/dashboard'
  } catch (err) {
    // Expired session → no switch is possible without a fresh login.
    if (err?.statusCode === 401 || err?.response?.status === 401) {
      navigateTo('/login')
      return
    }
    error.value = 'החלפת החשבון נכשלה. נסו שוב.'
    busy.value = false
    selectingId.value = ''
  }
}
</script>

<style lang="scss">
.SwitchAccountModal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: var(--spacing-md);
}

.SwitchAccountModal {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 24rem;
  display: flex;
  flex-direction: column;

  &-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-subtitle {
    margin: var(--spacing-2xs) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0;
    display: flex;
    flex-shrink: 0;
    &:hover { color: var(--color-text); }
  }

  &-body {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-error {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: 500;
    text-align: center;
  }

  &-accounts {
    list-style: none;
    margin: 0;
    padding: 0;
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
    &:disabled { cursor: not-allowed; }

    &--current {
      background: var(--light-bg);
      cursor: default;
      &:hover { border-color: var(--color-border); background: var(--light-bg); }
    }
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
    flex: 1;
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

  &-badge {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-radius: var(--radius-full);
    padding: var(--spacing-2xs) var(--spacing-sm);
  }

  &-spinner {
    flex-shrink: 0;
    color: var(--brand-dark-green);
    animation: switchAccountSpin 0.75s linear infinite;
  }

  @keyframes switchAccountSpin {
    to { transform: rotate(360deg); }
  }
}
</style>

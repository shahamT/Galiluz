<template>
  <div v-if="authStore.isLoggedIn && isProtectedRoute" ref="root" class="UserAvatar">
    <button
      type="button"
      class="UserAvatar-btn"
      :aria-label="authStore.user?.fullName"
      @click="open = !open"
    >
      {{ initials }}
    </button>

    <Transition name="UserAvatar-fade">
      <div v-if="open" class="UserAvatar-dropdown" role="menu">
        <button type="button" class="UserAvatar-close" aria-label="סגור" @click="open = false">
          <UiIcon name="close" size="md" />
        </button>
        <div class="UserAvatar-info">
          <div class="UserAvatar-fullName">{{ authStore.user?.fullName }}</div>
          <div class="UserAvatar-publishingAs">{{ authStore.user?.publishingAs }}</div>
          <div class="UserAvatar-phone" dir="ltr">{{ displayPhone }}</div>
        </div>
        <template v-if="canSwitch">
          <div class="UserAvatar-divider" aria-hidden="true" />
          <button type="button" class="UserAvatar-switch" @click="openSwitch">
            <UiIcon name="swap_horiz" size="sm" />
            החלפת חשבון
          </button>
        </template>
        <div class="UserAvatar-divider" aria-hidden="true" />
        <button type="button" class="UserAvatar-logout" @click="handleLogout">
          <UiIcon name="logout" size="sm" />
          התנתק
        </button>
      </div>
    </Transition>

    <LayoutSwitchAccountModal
      v-if="showSwitch"
      :business-accounts="businessAccounts"
      @close="showSwitch = false"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'UserAvatar' })

const authStore = useAuthStore()
const { logout, listMyAccounts } = useAuth()
const route = useRoute()
const isProtectedRoute = computed(() => route.path.startsWith('/publisher') || route.path.startsWith('/admin'))

const open = ref(false)
const root = ref(null)

// Account switcher: the switchable business accounts are loaded lazily the first time the
// menu opens. The "החלפת חשבון" button shows only when the user has 2+ contexts to choose
// from (business accounts + the management portal for platform staff) — single-account
// publishers never see a dead-end. A failed/expired fetch simply leaves the button hidden.
const businessAccounts = ref([])
const accountsLoaded = ref(false)
const showSwitch = ref(false)
const canSwitch = computed(() =>
  businessAccounts.value.length + (authStore.isPlatformStaff ? 1 : 0) >= 2
)

watch(open, async (isOpen) => {
  if (!isOpen || accountsLoaded.value) return
  accountsLoaded.value = true
  try {
    const accounts = await listMyAccounts()
    businessAccounts.value = Array.isArray(accounts) ? accounts : []
  } catch { /* expired/unavailable — keep the switch button hidden */ }
})

function openSwitch() {
  open.value = false
  showSwitch.value = true
}

const initials = computed(() => {
  const words = (authStore.user?.fullName || '').trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0]?.[0] || '?').toUpperCase()
})

const displayPhone = computed(() => {
  const w = authStore.user?.waId || ''
  const local = w.startsWith('972') ? '0' + w.slice(3) : w
  return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
})

async function handleLogout() {
  open.value = false
  await logout()
  window.location.href = 'https://galiluz.co.il'
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style lang="scss">
.UserAvatar {
  position: relative;
  flex-shrink: 0;

  &-btn {
    width: var(--control-height);
    height: var(--control-height);
    border-radius: var(--radius-full);
    background: var(--brand-dark-green);
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-family: var(--font-family-body);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover { opacity: 0.85; }
  }

  &-dropdown {
    position: absolute;
    top: calc(var(--control-height) + var(--spacing-xs));
    right: 0;
    min-width: 13rem;
    background: var(--color-background);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
    z-index: 1100;
    overflow: hidden;

    @media (max-width: 768px) {
      position: fixed;
      inset: 0;
      border-radius: 0;
      min-width: unset;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-end;
      border: none;
      box-shadow: none;
      padding-top: var(--header-height);
    }
  }

  &-close {
    display: none;

    @media (max-width: 768px) {
      display: flex;
      position: absolute;
      top: calc((var(--header-height) - var(--control-height)) / 2);
      left: var(--spacing-md);
      width: var(--control-height);
      height: var(--control-height);
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--brand-dark-green);
      transition: background-color 0.2s ease;

      &:hover, &:active { background-color: var(--light-bg); }
    }
  }

  &-info {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xs);
    text-align: right;
  }

  &-fullName {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-text);
  }

  &-publishingAs {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-phone {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    letter-spacing: 0.03em;
  }

  &-divider {
    height: 1px;
    background: var(--color-border);
  }

  &-switch {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    transition: background 0.15s;

    &:hover { background: var(--color-surface); }
  }

  &-logout {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-error);
    transition: background 0.15s;

    &:hover { background: var(--color-surface); }
  }

  &-fade-enter-active,
  &-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
  &-fade-enter-from,
  &-fade-leave-to { opacity: 0; transform: translateY(-4px); }
}
</style>

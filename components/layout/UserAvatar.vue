<template>
  <div v-if="authStore.isLoggedIn" ref="root" class="UserAvatar">
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
        <div class="UserAvatar-info">
          <div class="UserAvatar-fullName">{{ authStore.user?.fullName }}</div>
          <div class="UserAvatar-publishingAs">{{ authStore.user?.publishingAs }}</div>
          <div class="UserAvatar-phone" dir="ltr">{{ displayPhone }}</div>
        </div>
        <div class="UserAvatar-divider" aria-hidden="true" />
        <button type="button" class="UserAvatar-logout" @click="handleLogout">
          <UiIcon name="logout" size="sm" />
          התנתק
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineOptions({ name: 'UserAvatar' })

const authStore = useAuthStore()
const { logout } = useAuth()

const open = ref(false)
const root = ref(null)

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
    left: 0;
    min-width: 13rem;
    background: var(--color-background);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
    z-index: 1100;
    overflow: hidden;
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

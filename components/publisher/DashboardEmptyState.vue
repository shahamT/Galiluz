<template>
  <div class="DashboardEmptyState" :class="{ 'DashboardEmptyState--compact': compact }">
    <div class="DashboardEmptyState-illustration" aria-hidden="true">
      <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="120" height="90" rx="10" fill="#f2fbf8" stroke="#b4dac5" stroke-width="2"/>
        <rect x="20" y="30" width="120" height="26" rx="10" fill="#b4dac5"/>
        <rect x="20" y="46" width="120" height="10" fill="#b4dac5"/>
        <circle cx="40" cy="43" r="7" fill="white" opacity="0.7"/>
        <circle cx="60" cy="43" r="7" fill="white" opacity="0.7"/>
        <rect x="36" y="72" width="32" height="6" rx="3" fill="#b4dac5"/>
        <rect x="36" y="84" width="48" height="6" rx="3" fill="#e0e0e0"/>
        <rect x="36" y="96" width="40" height="6" rx="3" fill="#e0e0e0"/>
        <circle cx="120" cy="100" r="22" fill="#0b974a" opacity="0.12"/>
        <path d="M111 100 L118 107 L129 93" stroke="#0b974a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <p class="DashboardEmptyState-text">{{ text }}</p>
    <button v-if="showButton" type="button" class="DashboardEmptyState-btn" @click="$emit('action')">
      <UiIcon :name="buttonIcon" size="sm" />
      {{ buttonLabel }}
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardEmptyState' })

defineProps({
  text: {
    type: String,
    default: 'עדיין אין לכם אירועים',
  },
  buttonLabel: {
    type: String,
    default: 'פרסמו את האירוע הראשון שלכם!',
  },
  buttonIcon: {
    type: String,
    default: 'add',
  },
  showButton: {
    type: Boolean,
    default: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['action'])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.DashboardEmptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;

  &--compact {
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) var(--spacing-md);

    .DashboardEmptyState-illustration { width: 6rem; }
    .DashboardEmptyState-text {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
  }

  &-illustration {
    width: 10rem;
    opacity: 0.9;

    svg { width: 100%; height: auto; }
  }

  &-text {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
  }

  &-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-xl);
    background: var(--brand-dark-green);
    color: var(--chip-text-white);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover, &:visited, &:active { color: var(--chip-text-white); }
    &:hover { opacity: 0.9; }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
      padding: 0 var(--spacing-md);
    }
  }
}
</style>

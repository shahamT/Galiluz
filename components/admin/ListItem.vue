<template>
  <component
    :is="to ? linkComponent : 'div'"
    :to="to || undefined"
    class="AdminListItem"
    :class="{ 'AdminListItem--link': to, 'AdminListItem--muted': muted }"
  >
    <!-- Leading avatar: image, initials, or icon (mirrors EventListItem's thumbnail). -->
    <span class="AdminListItem-avatar" :class="`AdminListItem-avatar--${avatarVariant}`">
      <img v-if="avatarUrl" :src="avatarUrl" alt="" class="AdminListItem-avatarImg" />
      <span v-else-if="avatarText" class="AdminListItem-avatarText">{{ avatarText }}</span>
      <UiIcon v-else :name="avatarIcon" size="sm" />
    </span>

    <div class="AdminListItem-content">
      <div class="AdminListItem-titleRow">
        <span class="AdminListItem-title">{{ title }}</span>
        <span
          v-if="titleChip"
          class="AdminListItem-chip"
          :class="`AdminListItem-chip--${titleChip.variant || 'neutral'}`"
        >{{ titleChip.label }}</span>
      </div>
      <div v-if="chips.length" class="AdminListItem-chips">
        <span
          v-for="(chip, i) in chips"
          :key="i"
          class="AdminListItem-chip"
          :class="`AdminListItem-chip--${chip.variant || 'neutral'}`"
        >
          <UiIcon v-if="chip.icon" :name="chip.icon" size="xs" class="AdminListItem-chipIcon" />
          {{ chip.label }}
        </span>
      </div>
    </div>

    <div v-if="$slots.actions" class="AdminListItem-actions">
      <slot name="actions" />
    </div>
  </component>
</template>

<script setup>
defineOptions({ name: 'AdminListItem' })

// Resolve NuxtLink explicitly — the string form `:is="'NuxtLink'"` doesn't resolve the
// global component (renders an inert <nuxtlink>), so the row wasn't navigable.
const linkComponent = resolveComponent('NuxtLink')

defineProps({
  title: { type: String, default: '' },
  to: { type: String, default: null },
  muted: { type: Boolean, default: false },
  avatarUrl: { type: String, default: '' },
  avatarText: { type: String, default: '' },
  avatarIcon: { type: String, default: 'apartment' },
  avatarVariant: { type: String, default: 'default' }, // 'default' | 'accent'
  /** Chip shown inline next to the title: { label, variant }. */
  titleChip: { type: Object, default: null },
  /** Pill chips: [{ label, variant, icon }]. variant: green|blue|neutral|warm|danger|platform */
  chips: { type: Array, default: () => [] },
})
</script>

<style lang="scss">
.AdminListItem {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition: background 0.15s;

  &--link { cursor: pointer; }
  &--link:hover { background: var(--light-bg); }
  &--muted { opacity: 0.6; }

  &-avatar {
    flex-shrink: 0;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: var(--radius-md);
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--light-bg);
    color: var(--brand-dark-green);
    &--accent { background: var(--brand-dark-green); color: #fff; }
  }
  &-avatarImg { width: 100%; height: 100%; object-fit: cover; }
  &-avatarText { font-size: var(--font-size-lg); font-weight: 700; line-height: 1; }

  &-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-titleRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-width: 0;
  }

  &-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-chips { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }

  &-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 500;
    white-space: nowrap;

    &--green { background: var(--brand-light-green-hover); color: var(--brand-dark-green); }
    &--blue { background: rgba(128, 220, 218, 0.18); color: var(--brand-dark-blue); }
    &--neutral { background: var(--color-border); color: var(--color-text-light); }
    &--warm { background: rgba(224, 168, 62, 0.20); color: #8a5a00; }
    &--danger { background: rgba(211, 51, 51, 0.14); color: #a12626; }
    &--platform { background: var(--brand-dark-green); color: #fff; }
  }
  &-chipIcon { color: inherit; }

  &-actions { flex-shrink: 0; display: flex; align-items: center; gap: var(--spacing-xs); }
}
</style>

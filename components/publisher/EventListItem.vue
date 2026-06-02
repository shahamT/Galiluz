<template>
  <NuxtLink :to="`/publisher/events/${event.id}`" class="EventListItem">
    <div class="EventListItem-main">
      <span class="EventListItem-title">{{ event.title }}</span>
      <UiIcon name="chevron_left" size="sm" class="EventListItem-chevron" />
    </div>
    <div class="EventListItem-chips">
      <span
        v-for="occ in visibleOccurrences"
        :key="occ.date"
        class="EventListItem-chip EventListItem-chip--date"
      >{{ formatOccurrence(occ) }}</span>
      <span v-if="extraCount > 0" class="EventListItem-chip EventListItem-chip--more">
        +{{ extraCount }}
      </span>
      <span class="EventListItem-chip EventListItem-chip--price">
        {{ priceLabel }}
      </span>
    </div>
  </NuxtLink>
</template>

<script setup>
defineOptions({ name: 'EventListItem' })
const props = defineProps({
  event: { type: Object, required: true },
})

const sortedOccurrences = computed(() =>
  [...(props.event.occurrences || [])].sort((a, b) => a.date.localeCompare(b.date))
)
const visibleOccurrences = computed(() => sortedOccurrences.value.slice(0, 2))
const extraCount = computed(() => Math.max(0, sortedOccurrences.value.length - 2))

const priceLabel = computed(() => {
  const p = props.event.price
  if (!p || p === 0) return 'חינם'
  return `${p} ₪`
})

function formatOccurrence(occ) {
  const [y, m, d] = occ.date.split('-')
  const dateStr = `${parseInt(d)}/${m}/${y.slice(2)}`
  if (!occ.hasTime || !occ.startTime) return dateStr
  const time = new Date(occ.startTime).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${time} ,${dateStr}`
}
</script>

<style lang="scss">
.EventListItem {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition: background 0.15s;

  &:hover { background: var(--light-bg); }

  &-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  &-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--brand-dark-green);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-chevron {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  &-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  &-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 500;
    white-space: nowrap;

    &--date {
      background: var(--light-bg);
      color: var(--brand-dark-green);
    }

    &--more {
      background: var(--light-bg);
      color: var(--brand-dark-green);
    }

    &--price {
      background: rgba(128, 220, 218, 0.18);
      color: var(--brand-dark-blue);
    }
  }
}
</style>

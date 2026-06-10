<template>
  <NuxtLink :to="`/publisher/events/${event.id}`" class="EventListItem">
    <img :src="thumbnailUrl" class="EventListItem-thumbnail" alt="" />
    <div class="EventListItem-content">
      <div class="EventListItem-titleRow">
        <span class="EventListItem-title">{{ event.title }}</span>
        <span
          v-if="!event.isActive"
          class="EventListItem-chip EventListItem-chip--status EventListItem-chip--status-draft"
        >טיוטה</span>
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
    </div>
  </NuxtLink>
</template>

<script setup>
import { isVideoUrl, getCloudinaryVideoThumbnailUrl } from '~/utils/media.helpers.js'

defineOptions({ name: 'EventListItem' })
const props = defineProps({
  event: { type: Object, required: true },
})

const thumbnailUrl = computed(() => {
  const media = props.event.media ?? []
  if (!media.length) return '/imgs/default-event-bg.webp'
  const items = media
    .map(item => {
      const url = typeof item === 'string' ? item : item?.cloudinaryURL ?? item?.url
      if (!url) return null
      return { url, isMain: typeof item === 'object' && item?.isMain === true }
    })
    .filter(Boolean)
    .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
  if (!items.length) return '/imgs/default-event-bg.webp'
  const { url } = items[0]
  return isVideoUrl(url) ? getCloudinaryVideoThumbnailUrl(url) : url
})

const isMobile = useMediaQuery('(max-width: 768px)')
const sortedOccurrences = computed(() =>
  [...(props.event.occurrences || [])].sort((a, b) => a.date.localeCompare(b.date))
)
const visibleCount = computed(() => isMobile.value ? 1 : 2)
const visibleOccurrences = computed(() => sortedOccurrences.value.slice(0, visibleCount.value))
const extraCount = computed(() => Math.max(0, sortedOccurrences.value.length - visibleCount.value))

const priceLabel = computed(() => {
  const p = props.event.price
  if (!p || p === 0) return 'חינם'
  return `${p} ₪`
})

function formatOccurrence(occ) {
  const [y, m, d] = occ.date.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' })
  const dateStr = `${d}.${m}`
  if (!occ.hasTime || !occ.startTime) return `${dayName} | ${dateStr}`
  const time = new Date(occ.startTime).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dayName} | ${dateStr} | ${time}`
}
</script>

<style lang="scss">
.EventListItem {
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

  &:hover { background: var(--light-bg); }

  &-thumbnail {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: var(--radius-md);
    object-fit: cover;
    flex-shrink: 0;
  }

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
    flex: 1;
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
      background: var(--brand-light-green-hover);
      color: var(--brand-dark-green);
    }

    &--more {
      background: var(--brand-light-green-hover);
      color: var(--brand-dark-green);
    }

    &--price {
      background: rgba(128, 220, 218, 0.18);
      color: var(--brand-dark-blue);
    }

    &--status-draft {
      background: var(--color-border);
      color: var(--color-text-light);
    }
  }
}
</style>

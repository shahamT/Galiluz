<template>
  <div class="EventModal-actions">
    <div v-if="calendarStartDate" class="EventModal-actionBar">
      <button
        ref="calendarButtonRef"
        type="button"
        class="EventModal-calendarButton"
        @click="toggleCalendarPopup"
      >
        <UiIcon name="event_available" size="sm" />
        {{ MODAL_TEXT.addToCalendar }}
      </button>
      <button
        ref="navigateButtonRef"
        type="button"
        class="EventModal-navigateButton"
        @click="toggleNavigationPopup"
      >
        <UiIcon name="directions" size="sm" />
        {{ MODAL_TEXT.navigateToEvent }}
      </button>
    </div>
  </div>

  <!-- Calendar Options Popup -->
  <Teleport to="body">
    <UiCalendarOptionsPopup
      v-if="isCalendarPopupOpen && calendarButtonRef && event"
      :trigger-element="calendarButtonRef"
      :calendar-options="CALENDAR_OPTIONS"
      :event-name="event.title"
      @close="isCalendarPopupOpen = false"
      @select="handleCalendarSelect"
    />
  </Teleport>

  <!-- Navigation Options Popup -->
  <Teleport to="body">
    <UiNavigationOptionsPopup
      v-if="isNavigationPopupOpen && navigateButtonRef && event"
      :trigger-element="navigateButtonRef"
      :navigation-options="NAVIGATION_OPTIONS"
      :event-name="event.title"
      @close="isNavigationPopupOpen = false"
      @select="handleNavigationSelect"
    />
  </Teleport>
</template>

<script setup>
import { handleCalendarSelection } from '~/utils/calendar.service'
import { handleNavigationSelection } from '~/utils/navigation.service'
import { MODAL_TEXT, CALENDAR_OPTIONS, NAVIGATION_OPTIONS } from '~/consts/ui.const'

defineOptions({ name: 'EventModalActions' })

const props = defineProps({
  calendarStartDate: {
    type: String,
    default: '',
  },
  event: {
    type: Object,
    default: null,
  },
  eventDescription: {
    type: String,
    default: '',
  },
  formattedLocation: {
    type: String,
    default: '',
  },
  location: {
    type: Object,
    default: null,
  },
  calendarStartTime: {
    type: String,
    default: '',
  },
  calendarEndDate: {
    type: String,
    default: '',
  },
  calendarEndTime: {
    type: String,
    default: '',
  },
})

const route = useRoute()

const isCalendarPopupOpen = ref(false)
const calendarButtonRef = ref(null)
const isNavigationPopupOpen = ref(false)
const navigateButtonRef = ref(null)

const EVENT_PAGE_LABEL = 'לעמוד האירוע בגלילו"ז:'

function getEventPageUrl() {
  if (!import.meta.client || !props.event?.id) return ''
  const params = new URLSearchParams({ ...route.query, event: props.event.id })
  return `${window.location.origin}${route.path}?${params.toString()}`
}

function stripHtml(html) {
  if (!html) return ''
  if (import.meta.client) {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent?.trim() || ''
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildCalendarDescription() {
  const eventPageUrl = getEventPageUrl()
  const prefix = eventPageUrl
    ? `${EVENT_PAGE_LABEL}\n${eventPageUrl}`
    : ''
  const body = stripHtml(props.eventDescription)
  if (!prefix && !body) return ''
  if (!prefix) return body
  if (!body) return prefix
  return `${prefix}\n\n${body}`
}

const toggleCalendarPopup = () => {
  isNavigationPopupOpen.value = false
  isCalendarPopupOpen.value = !isCalendarPopupOpen.value
}

const toggleNavigationPopup = () => {
  isCalendarPopupOpen.value = false
  isNavigationPopupOpen.value = !isNavigationPopupOpen.value
}

const handleCalendarSelect = async (calendarType) => {
  const eventData = {
    title: props.event?.title || '',
    description: buildCalendarDescription(),
    location: props.formattedLocation,
    startDate: props.calendarStartDate,
    startTime: props.calendarStartTime,
    endDate: props.calendarEndDate,
    endTime: props.calendarEndTime,
  }
  await handleCalendarSelection(calendarType, eventData)
}

const handleNavigationSelect = (navType) => {
  handleNavigationSelection(navType, props.location)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventModal {
  &-actions {
    @include mobile {
      flex-shrink: 0;
    }
  }

  &-actionBar {
    background-color: var(--color-background);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--spacing-md);
    position: sticky;
    bottom: 0;
    box-shadow: var(--shadow-top);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);

    @include mobile {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: var(--spacing-md);
      padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
      border-top: 1px solid var(--color-border);
      box-shadow: var(--shadow-top);
      gap: var(--spacing-sm);
      border-radius: 0;
      z-index: 10;
    }
  }

  &-calendarButton {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--color-primary);
    color: var(--chip-text-white);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;

    &:hover {
      background-color: color-mix(in srgb, var(--color-primary) 85%, black);
    }

    &:active {
      transform: scale(0.98);
    }

    @include mobile {
      padding-block: 0.75rem;
      font-size: var(--font-size-base);

      .Icon {
        font-size: var(--icon-size-md);
      }

      @media (max-width: 370px) {
        font-size: var(--font-size-xs);
      }
    }
  }

  &-navigateButton {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--brand-dark-green);
    color: var(--chip-text-white);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;

    &:hover {
      background-color: color-mix(in srgb, var(--brand-dark-green) 85%, black);
    }

    &:active {
      transform: scale(0.98);
    }

    @include mobile {
      padding-block: 0.75rem;
      font-size: var(--font-size-base);

      .Icon {
        font-size: var(--icon-size-md);
      }

      @media (max-width: 370px) {
        font-size: var(--font-size-xs);
      }
    }
  }
}
</style>

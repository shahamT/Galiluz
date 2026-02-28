<template>
  <Teleport to="body">
    <div v-if="isEventModalShowing" class="EventModal" @click.self="closeModal">
      <!-- Light overlay while gallery media load (screen looks disabled) -->
      <div
        v-if="selectedEvent && eventMedia.length && !isGalleryMediaLoaded"
        class="EventModal-loadingOverlay"
        aria-hidden="true"
      />
      <!-- Modal content: only after loading (or when no event / no media) -->
      <div
        v-else
        class="EventModal-content"
        :class="{ 'EventModal-content--mobile': isMobile }"
      >
        <div v-if="!selectedEvent" class="EventModal-notFoundWrapper">
          <p class="EventModal-notFound">{{ MODAL_TEXT.noEventSelected }}</p>
        </div>
        <template v-else>
          <!-- Disclaimer Note (Above Header for all screens) -->
          <div class="EventModal-disclaimer">
            <span class="EventModal-disclaimerText">{{ MODAL_TEXT.disclaimer }}</span>
          </div>

          <!-- Image Header -->
          <UiEventModalHeader
            :event="selectedEvent"
            :categories="categories"
            :event-image="eventImage"
            :can-share="canShare"
            @close="closeModal"
            @share="handleShare"
          />

          <!-- Scrollable Body -->
          <div class="EventModal-body">
            <div class="EventModal-bodyInner">
            <!-- Info Bar (Location, Time, Price) -->
            <UiEventModalInfoBar
              :basic-location="basicLocation"
              :event-date-and-day="eventDateAndDay"
              :event-time="eventTime"
              :event-price="eventPrice"
              :has-location-details="hasLocationDetails"
              :formatted-location="formattedLocation"
            />

            <!-- Event Image Gallery -->
            <div v-if="eventMedia.length" ref="galleryRef" class="EventModal-imageGallery">
              <template v-for="(item, idx) in visibleMedia" :key="idx">
                <div
                  v-if="showOverflow && idx === visibleMedia.length - 1"
                  class="EventModal-galleryThumb"
                  @click="openImagePopup(idx)"
                >
                  <img :src="item.displayUrl" :alt="selectedEvent.title" class="EventModal-galleryThumbImage" />
                  <div class="EventModal-galleryOverlay">
                    <span class="EventModal-galleryOverlayText">+{{ overflowCount }}</span>
                  </div>
                </div>
                <div v-else class="EventModal-galleryThumb" @click="openImagePopup(idx)">
                  <img :src="item.displayUrl" :alt="selectedEvent.title" class="EventModal-galleryThumbImage" />
                  <div v-if="item.isVideo" class="EventModal-galleryOverlay EventModal-galleryOverlay--play">
                    <UiIcon name="play_circle" size="xl" color="var(--chip-text-white)" class="EventModal-galleryPlayIcon" />
                  </div>
                </div>
              </template>
            </div>

            <!-- Links Section (links only, no contact publisher) -->
            <UiEventModalLinksSection
              v-if="selectedEvent.urls?.length"
              :links="selectedEvent.urls"
              :show-contact-publisher="false"
              :has-top-padding="true"
              @link-click="trackCustomLinkClick"
            />

            <!-- Description Section -->
            <div v-if="eventDescription" class="EventModal-descriptionSection">
              <div class="EventModal-description" v-html="eventDescription"></div>
            </div>

            <!-- Links & Contact Section (bottom) -->
            <UiEventModalLinksSection
              v-if="selectedEvent.urls?.length || selectedEvent.publisherPhone"
              :links="selectedEvent.urls"
              :show-contact-publisher="true"
              :whatsapp-link="whatsappLink"
              @link-click="trackCustomLinkClick"
              @contact-publisher="trackContactPublisher"
            />

            <!-- Dev only: event id -->
            <DevOnly>
              <div class="EventModal-devId">id: {{ selectedEvent?.id }}</div>
            </DevOnly>
            </div>
          </div>

          <!-- Actions Bar -->
          <UiEventModalActions
            :calendar-start-date="calendarStartDate"
            :event="selectedEvent"
            :event-description="eventDescription"
            :formatted-location="formattedLocation"
            :location="selectedEvent.location"
            :calendar-start-time="calendarStartTime"
            :calendar-end-date="calendarEndDate"
            :calendar-end-time="calendarEndTime"
          />
        </template>
      </div>
    </div>
  </Teleport>

  <!-- Image/Video Full-Size Popup -->
  <Teleport to="body">
    <UiImagePopup
      v-if="isImagePopupOpen && eventMedia.length"
      :items="eventMedia"
      :current-index="currentImageIndex"
      :alt-text="selectedEvent?.title"
      @close="closeImagePopup"
    />
  </Teleport>
</template>

<script setup>
import { MODAL_TEXT, MOBILE_BREAKPOINT } from '~/consts/ui.const'
import { ANALYTICS_EVENTS } from '~/consts/analytics.const'
import { useEventModalData } from '~/composables/useEventModalData'
import { useEventModalGallery } from '~/composables/useEventModalGallery'
import { useEventModalShare } from '~/composables/useEventModalShare'
import { useEventModalImagePopup } from '~/composables/useEventModalImagePopup'

defineOptions({ name: 'EventModal' })

const uiStore = useUiStore()
const { isEventModalShowing, selectedEventId } = storeToRefs(uiStore)
const { events, categories } = useCalendarViewData()

const isMobile = useScreenWidth(MOBILE_BREAKPOINT)

const selectedEvent = computed(() => {
  if (!selectedEventId.value || !events.value) return null
  return events.value.find((event) => event.id === selectedEventId.value) || null
})

const modalPageTitle = computed(() =>
  selectedEvent.value?.title ? `גלילו"ז - ${selectedEvent.value.title}` : 'גלילו"ז'
)
useHead({ title: modalPageTitle })

const selectedOccurrence = computed(() => selectedEvent.value || null)

const {
  eventImage,
  eventImages,
  eventMedia,
  eventTime,
  eventDateAndDay,
  eventPrice,
  eventDescription,
  basicLocation,
  formattedLocation,
  hasLocationDetails,
  whatsappLink,
  calendarStartDate,
  calendarStartTime,
  calendarEndDate,
  calendarEndTime,
} = useEventModalData(selectedEvent, selectedOccurrence)

const {
  galleryRef,
  isGalleryMediaLoaded,
  showOverflow,
  overflowCount,
  visibleMedia,
} = useEventModalGallery(eventMedia)

const { canShare, handleShare } = useEventModalShare(selectedEvent)

const { isImagePopupOpen, currentImageIndex, openImagePopup, closeImagePopup } = useEventModalImagePopup()

const { capture } = usePosthog()

watch(selectedEventId, (eventId) => {
  if (import.meta.server) return
  if (eventId) {
    capture(ANALYTICS_EVENTS.EVENT_VIEWED, { event_id: eventId })
  }
}, { immediate: true })

function trackContactPublisher() {
  if (selectedEvent.value?.id) {
    capture(ANALYTICS_EVENTS.EVENT_CONTACT_PUBLISHER_CLICKED, { event_id: selectedEvent.value.id })
  }
}

function trackCustomLinkClick(link, index) {
  if (selectedEvent.value?.id) {
    capture(ANALYTICS_EVENTS.EVENT_CUSTOM_LINK_CLICKED, {
      event_id: selectedEvent.value.id,
      link_title: link?.Title ?? '',
      link_type: link?.type ?? 'link',
      link_index: index,
    })
  }
}

const closeModal = () => {
  closeImagePopup()
  uiStore.closeEventModal()
}

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

watch(isEventModalShowing, (isShowing) => {
  if (import.meta.server) return
  document.body.style.overflow = isShowing ? 'hidden' : ''
}, { immediate: true })
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventModal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--modal-backdrop-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: var(--z-index-modal);
  padding: var(--spacing-lg);
  padding-top: var(--spacing-xl);
  overflow-y: auto;
  direction: ltr;

  @include mobile {
    padding: 0;
    overflow-y: auto;
  }

  &-content {
    direction: rtl;
    background-color: var(--color-background);
    border-radius: var(--radius-lg);
    max-width: 600px;
    width: 90%;
    box-shadow: var(--shadow-lg);
    position: relative;

    @include mobile {
      width: 100%;
      max-width: none;
      min-height: 100vh;
      border-radius: 0;
      display: flex;
      flex-direction: column;
    }

    &--mobile {
      @include mobile {
        height: 100vh;
      }
    }
  }

  &-body {
    direction: ltr;

    @include mobile {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      background-color: var(--color-background);
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0));
    }
  }

  &-bodyInner {
    direction: rtl;
  }

  &-devId {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  &-notFoundWrapper {
    padding: var(--spacing-xl);
  }

  &-notFound {
    text-align: center;
    color: var(--color-text-light);
    padding: var(--spacing-xl);
  }

  &-loadingOverlay {
    position: absolute;
    inset: 0;
    background-color: var(--overlay-light);
    pointer-events: none;
  }

  &-disclaimer {
    background-color: var(--disclaimer-bg);
    padding: var(--spacing-sm) var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;

    @include mobile {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: 0;
    }
  }

  &-disclaimerText {
    font-size: var(--font-size-2xs);
    color: var(--disclaimer-text);
    line-height: 1.4;
    text-align: center;
  }

  &-imageGallery {
    background-color: var(--color-background);
    padding: var(--spacing-lg);
    padding-bottom: 0;
    display: flex;
    justify-content: flex-start;
    gap: var(--spacing-md);

    @include mobile {
      padding: var(--spacing-md);
      padding-bottom: 0;
      justify-content: center;
    }
  }

  &-galleryThumb {
    position: relative;
    width: 93px;
    height: 140px;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease;

    &:hover {
      box-shadow: var(--shadow-md);
      transform: scale(1.02);
    }
  }

  &-galleryThumbImage {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background-color: var(--color-surface);
  }

  &-galleryOverlay {
    position: absolute;
    inset: 0;
    background-color: var(--overlay-dark);
    display: flex;
    align-items: center;
    justify-content: center;

    &--play {
      background-color: var(--overlay-dark-light);
    }
  }

  &-galleryPlayIcon {
    font-size: 2.5rem;
  }

  &-galleryOverlayText {
    color: var(--chip-text-white);
    font-size: var(--font-size-xl);
    font-weight: 700;
  }

  &-descriptionSection {
    background-color: var(--color-background);
    padding: var(--spacing-lg);

    @include mobile {
      padding: var(--spacing-md);
    }
  }

  &-description {
    font-size: var(--font-size-base);
    color: var(--color-text);
    line-height: 1.6;
    margin: 0;

    // HTML content styles
    p {
      margin: 0 0 1em 0;

      &:last-child {
        margin-bottom: 0;
      }
    }

    ul, ol {
      margin: 0 0 1em 0;
      padding-right: 1.5em;
      padding-left: 0;

      &:last-child {
        margin-bottom: 0;
      }
    }

    li {
      margin-bottom: 0.5em;

      &:last-child {
        margin-bottom: 0;
      }
    }

    a {
      color: var(--color-primary);
      text-decoration: underline;

      &:hover {
        opacity: 0.8;
      }
    }

    strong, b {
      font-weight: 700;
    }

    em, i {
      font-style: italic;
    }

    h1, h2, h3, h4, h5, h6 {
      margin: 0 0 0.75em 0;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.4;

      &:last-child {
        margin-bottom: 0;
      }
    }

    h1 { font-size: var(--font-size-xl); }
    h2 { font-size: var(--font-size-lg); }
    h3, h4, h5, h6 { font-size: var(--font-size-base); }

    blockquote {
      margin: 0 0 1em 0;
      padding-inline-start: var(--spacing-md);
      border-inline-start: 4px solid var(--color-border);
      color: var(--color-text-light);

      &:last-child {
        margin-bottom: 0;
      }

      p {
        margin: 0;
      }
    }

    code {
      font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
      font-size: 0.9em;
      background-color: var(--color-surface);
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
    }

    pre {
      font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
      font-size: 0.875rem;
      background-color: var(--color-surface);
      padding: var(--spacing-md);
      border-radius: var(--radius-md);
      margin: 0 0 1em 0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;

      &:last-child {
        margin-bottom: 0;
      }

      code {
        background: none;
        padding: 0;
      }
    }

    del {
      text-decoration: line-through;
      color: var(--color-text-light);
    }
  }
}
</style>

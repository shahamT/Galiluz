<template>
  <div class="EventPreview">
    <UiEventModalHeader
      :event="eventShape"
      :categories="categories"
      :event-image="eventImage"
      :can-share="false"
    />

    <div class="EventModal-body">
      <div class="EventModal-bodyInner">
        <UiEventModalInfoBar
          :basic-location="basicLocation"
          :event-date-and-day="eventDateAndDay"
          :event-time="eventTime"
          :event-price="eventPrice"
          :has-location-details="hasLocationDetails"
          :formatted-location="formattedLocation"
        />

        <div v-if="eventMedia.length" ref="galleryRef" class="EventModal-imageGallery">
          <div
            v-for="(item, idx) in visibleMedia"
            :key="idx"
            class="EventModal-galleryThumb"
            @click="openImagePopup(idx)"
          >
            <img :src="item.displayUrl" :alt="event.title" class="EventModal-galleryThumbImage" />
            <div v-if="item.isVideo" class="EventModal-galleryOverlay EventModal-galleryOverlay--play">
              <UiIcon name="play_circle" size="xl" color="var(--chip-text-white)" class="EventModal-galleryPlayIcon" />
            </div>
            <div v-if="showOverflow && idx === visibleMedia.length - 1" class="EventModal-galleryOverlay">
              <span class="EventModal-galleryOverlayText">+{{ overflowCount }}</span>
            </div>
          </div>
        </div>

        <UiEventModalLinksSection
          v-if="event.urls?.length"
          :links="event.urls"
          :show-contact-publisher="false"
          :has-top-padding="true"
        />

        <div v-if="eventDescription" class="EventModal-descriptionSection">
          <div class="EventModal-description" v-html="eventDescription" />
        </div>
      </div>
    </div>

    <UiEventModalActions
      :calendar-start-date="calendarStartDate"
      :calendar-start-time="calendarStartTime"
      :calendar-end-date="calendarEndDate"
      :calendar-end-time="calendarEndTime"
      :event="eventShape"
      :event-description="eventDescription"
      :formatted-location="formattedLocation"
      :location="eventShape.location"
    />
  </div>

  <Teleport to="body">
    <UiImagePopup
      v-if="isImagePopupOpen && eventMedia.length"
      :items="eventMedia"
      :current-index="currentImageIndex"
      :alt-text="event.title"
      @close="closeImagePopup"
    />
  </Teleport>
</template>

<script setup>
import { useEventModalData } from '~/composables/useEventModalData'
import { useEventModalGallery } from '~/composables/useEventModalGallery'
import { useEventModalImagePopup } from '~/composables/useEventModalImagePopup'

defineOptions({ name: 'PublisherEventPreview' })

const props = defineProps({
  event: { type: Object, required: true },
})

const { categories } = useCalendarViewData()

// Pick best occurrence: first future one, else first overall
const selectedOccurrence = computed(() => {
  const occs = props.event.occurrences || []
  if (!occs.length) return null
  const today = new Date().toISOString().slice(0, 10)
  return occs.find(o => o.date >= today) || occs[0]
})

// Merge selected occurrence to top level — modal sub-components read date/time from event root
const eventShape = computed(() => ({
  ...props.event,
  date:      selectedOccurrence.value?.date || '',
  hasTime:   selectedOccurrence.value?.hasTime || false,
  startTime: selectedOccurrence.value?.startTime || null,
  endTime:   selectedOccurrence.value?.endTime || null,
}))

const {
  eventImage, eventMedia,
  eventTime, eventDateAndDay, eventPrice, eventDescription,
  basicLocation, formattedLocation, hasLocationDetails,
  calendarStartDate, calendarStartTime, calendarEndDate, calendarEndTime,
} = useEventModalData(eventShape, selectedOccurrence)

const { galleryRef, showOverflow, overflowCount, visibleMedia } = useEventModalGallery(eventMedia)
const { isImagePopupOpen, currentImageIndex, openImagePopup, closeImagePopup } = useEventModalImagePopup()
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventPreview {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;

  .EventModal-closeButton {
    display: none;
  }

  @include mobile {
    .EventModal-actionBar {
      position: static !important;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      padding: var(--spacing-md) var(--spacing-lg);
      left: unset;
      right: unset;
      bottom: unset;
    }
  }
}
</style>

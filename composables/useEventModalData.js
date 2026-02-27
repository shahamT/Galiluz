import { formatEventTime, formatEventPrice } from '~/utils/events.helpers'
import { getDateInIsraelFromIso } from '~/utils/israelDate'
import { formatEventDateAndDay } from '~/utils/date.helpers'
import { isVideoUrl, getCloudinaryVideoThumbnailUrl } from '~/utils/media.helpers'
import { MODAL_TEXT } from '~/consts/ui.const'

/**
 * Builds an array of non-empty address parts from a location object.
 * Order: locationName (venue), addressLine1, addressLine2, city.
 * @param {Object} loc - Location object
 * @returns {string[]}
 */
function buildAddressParts(loc) {
  const parts = []
  if (loc.locationName) parts.push(loc.locationName)
  if (loc.addressLine1) parts.push(loc.addressLine1)
  if (loc.addressLine2) parts.push(loc.addressLine2)
  if (loc.city) parts.push(loc.city)
  return parts
}

/**
 * Formats a Date object's local time to an HH:mm string.
 * @param {Date} date
 * @returns {string}
 */
function formatTimeFromDate(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Composable that derives all display-computed values for the EventModal.
 *
 * @param {import('vue').ComputedRef} selectedEvent
 * @param {import('vue').ComputedRef} selectedOccurrence
 */
export function useEventModalData(selectedEvent, selectedOccurrence) {
  // --- Media ---

  const eventImage = computed(() => {
    const media = eventMedia.value
    if (media && media.length > 0) {
      return media[0].displayUrl
    }
    return '/imgs/default-event-bg.webp'
  })

  const hasEventImage = computed(() => {
    const media = selectedEvent.value?.media
    return !!(media && media.length > 0)
  })

  const eventImages = computed(() => {
    const media = selectedEvent.value?.media
    if (!media || media.length === 0) return []
    return media
      .map((item) =>
        typeof item === 'string' ? item : item?.cloudinaryURL ?? item?.url
      )
      .filter(Boolean)
  })

  const eventMedia = computed(() => {
    const media = selectedEvent.value?.media ?? []
    if (!media.length) return []
    const withUrls = media
      .map((item) => {
        const url =
          typeof item === 'string' ? item : item?.cloudinaryURL ?? item?.url
        if (!url) return null
        const isVideo = isVideoUrl(url)
        return {
          url,
          isVideo,
          displayUrl: isVideo ? getCloudinaryVideoThumbnailUrl(url) : url,
          isMain: typeof item === 'object' && item?.isMain === true,
        }
      })
      .filter(Boolean)
    const mainFirst = [...withUrls].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
    return mainFirst
  })

  // --- Display info ---

  const eventTime = computed(() => {
    if (!selectedOccurrence.value) return ''
    return formatEventTime(selectedOccurrence.value)
  })

  const eventDateAndDay = computed(() => {
    const dateStr = calendarStartDate.value
    return dateStr ? formatEventDateAndDay(dateStr) : ''
  })

  const eventPrice = computed(() => {
    if (!selectedEvent.value) return ''
    return formatEventPrice(selectedEvent.value)
  })

  const eventDescription = computed(() => {
    if (!selectedEvent.value) return ''
    return (
      selectedEvent.value.fullDescription ||
      selectedEvent.value.shortDescription ||
      selectedEvent.value.description ||
      ''
    )
  })

  // --- Location ---

  const basicLocation = computed(() => {
    if (!selectedEvent.value?.location) return MODAL_TEXT.unknownLocation
    const parts = buildAddressParts(selectedEvent.value.location)
    return parts.length === 0 ? MODAL_TEXT.unknownLocation : parts.join(', ')
  })

  const formattedLocation = computed(() => {
    if (!selectedEvent.value?.location) return MODAL_TEXT.unknownLocation
    const loc = selectedEvent.value.location
    const parts = buildAddressParts(loc)
    if (parts.length === 0) return MODAL_TEXT.unknownLocation
    let result = parts.join(', ')
    if (loc.locationDetails) result += `\n${loc.locationDetails}`
    return result
  })

  const hasLocationDetails = computed(() => {
    return !!selectedEvent.value?.location?.locationDetails
  })

  // --- Contact ---

  const whatsappLink = computed(() => {
    if (!selectedEvent.value?.publisherPhone) return ''
    const cleanPhone = selectedEvent.value.publisherPhone.replace(/\D/g, '')
    return `https://wa.me/${cleanPhone}`
  })

  // --- Calendar dates ---

  const calendarStartDate = computed(() => {
    const occ = selectedOccurrence.value
    if (occ?.date && String(occ.date).trim()) {
      const d = String(occ.date).trim().slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    }
    if (!occ?.startTime) return ''
    return getDateInIsraelFromIso(occ.startTime) || new Date(occ.startTime).toISOString().split('T')[0]
  })

  const calendarStartTime = computed(() => {
    if (!selectedOccurrence.value?.startTime || !selectedOccurrence.value?.hasTime) return ''
    return formatTimeFromDate(new Date(selectedOccurrence.value.startTime))
  })

  const calendarEndDate = computed(() => {
    if (!selectedOccurrence.value?.endTime) return calendarStartDate.value
    return new Date(selectedOccurrence.value.endTime).toISOString().split('T')[0]
  })

  const calendarEndTime = computed(() => {
    if (!selectedOccurrence.value?.endTime || !selectedOccurrence.value?.hasTime) return ''
    return formatTimeFromDate(new Date(selectedOccurrence.value.endTime))
  })

  return {
    eventImage,
    hasEventImage,
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
  }
}

import { createEvent } from 'ics'
import { logger } from '~/utils/logger'

/**
 * Convert date string to ICS format array [year, month, day, hour, minute]
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in HH:MM format (optional)
 * @returns {Array<number>} - Array in ICS format
 */
function dateToIcsArray(dateStr, timeStr = '') {
  const [year, month, day] = dateStr.split('-').map(Number)
  
  if (timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number)
    return [year, month, day, hour, minute]
  }
  
  return [year, month, day]
}

/**
 * Convert date and time to Google Calendar format (YYYYMMDDTHHmmss or YYYYMMDD)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in HH:MM format (optional)
 * @returns {string} - Formatted date string for Google Calendar
 */
function dateToGoogleFormat(dateStr, timeStr = '') {
  const cleanDate = dateStr.replace(/-/g, '')
  
  if (timeStr) {
    const cleanTime = timeStr.replace(/:/g, '') + '00'
    return `${cleanDate}T${cleanTime}`
  }
  
  return cleanDate
}

/**
 * Add one calendar day to a date string.
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Next day in YYYY-MM-DD format
 */
function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  const nextY = date.getFullYear()
  const nextM = String(date.getMonth() + 1).padStart(2, '0')
  const nextD = String(date.getDate()).padStart(2, '0')
  return `${nextY}-${nextM}-${nextD}`
}

/**
 * Add one hour to start date/time; handles day rollover.
 * @param {string} startDateStr - Start date YYYY-MM-DD
 * @param {string} startTimeStr - Start time HH:MM
 * @returns {{ endDate: string, endTime: string }} - End date and time in same formats
 */
function addOneHour(startDateStr, startTimeStr) {
  const [y, m, d] = startDateStr.split('-').map(Number)
  const [hour, minute] = startTimeStr.split(':').map(Number)
  const date = new Date(y, m - 1, d, hour, minute)
  date.setHours(date.getHours() + 1)
  const endY = date.getFullYear()
  const endM = String(date.getMonth() + 1).padStart(2, '0')
  const endD = String(date.getDate()).padStart(2, '0')
  const endDate = `${endY}-${endM}-${endD}`
  const endTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return { endDate, endTime }
}

/**
 * Generate and download ICS file for calendar event
 * @param {Object} eventData - Event data object
 * @param {string} eventData.title - Event title
 * @param {string} eventData.description - Event description
 * @param {string} eventData.location - Event location
 * @param {string} eventData.startDate - Start date (YYYY-MM-DD)
 * @param {string} eventData.startTime - Start time (HH:MM) - optional
 * @param {string} eventData.endDate - End date (YYYY-MM-DD)
 * @param {string} eventData.endTime - End time (HH:MM) - optional
 * @returns {Promise<boolean>} - Success status
 */
export async function downloadIcsFile(eventData) {
  const { title, description, location, startDate, startTime, endDate, endTime } = eventData
  
  if (!startDate) {
    logger.error('[CalendarService]', 'Start date is required for calendar event')
    return false
  }

  const isAllDay = !startTime
  let icsStart = dateToIcsArray(startDate, startTime)
  let icsEnd

  if (isAllDay) {
    const endDateExclusive = addOneDay(endDate || startDate)
    icsEnd = dateToIcsArray(endDateExclusive, '')
  } else if (!endTime) {
    const { endDate: computedEndDate, endTime: computedEndTime } = addOneHour(startDate, startTime)
    icsEnd = dateToIcsArray(computedEndDate, computedEndTime)
  } else {
    icsEnd = dateToIcsArray(endDate || startDate, endTime)
  }

  const event = {
    start: icsStart,
    end: icsEnd,
    title: title || 'Event',
    description: description || '',
    location: location || '',
    status: 'CONFIRMED',
  }
  
  return new Promise((resolve) => {
    createEvent(event, (error, value) => {
      if (error) {
        logger.error('[CalendarService]', 'Error creating ICS file:', error)
        resolve(false)
        return
      }
      
      try {
        // Create blob and download
        const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${title || 'event'}.ics`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        resolve(true)
      } catch (err) {
        logger.error('[CalendarService]', 'Error downloading ICS file:', err)
        resolve(false)
      }
    })
  })
}

/**
 * Generate Google Calendar URL
 * @param {Object} eventData - Event data object
 * @param {string} eventData.title - Event title
 * @param {string} eventData.description - Event description
 * @param {string} eventData.location - Event location
 * @param {string} eventData.startDate - Start date (YYYY-MM-DD)
 * @param {string} eventData.startTime - Start time (HH:MM) - optional
 * @param {string} eventData.endDate - End date (YYYY-MM-DD)
 * @param {string} eventData.endTime - End time (HH:MM) - optional
 * @returns {string} - Google Calendar URL
 */
export function getGoogleCalendarUrl(eventData) {
  const { title, description, location, startDate, startTime, endDate, endTime } = eventData
  
  if (!startDate) {
    logger.error('[CalendarService]', 'Start date is required for calendar event')
    return ''
  }

  const isAllDay = !startTime
  let startDateTime
  let endDateTime

  if (isAllDay) {
    startDateTime = dateToGoogleFormat(startDate, '')
    endDateTime = dateToGoogleFormat(addOneDay(endDate || startDate), '')
  } else if (!endTime) {
    const { endDate: computedEndDate, endTime: computedEndTime } = addOneHour(startDate, startTime)
    startDateTime = dateToGoogleFormat(startDate, startTime)
    endDateTime = dateToGoogleFormat(computedEndDate, computedEndTime)
  } else {
    startDateTime = dateToGoogleFormat(startDate, startTime)
    endDateTime = dateToGoogleFormat(endDate || startDate, endTime)
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Event',
    dates: `${startDateTime}/${endDateTime}`,
  })
  
  if (description) {
    params.append('details', description)
  }
  
  if (location) {
    params.append('location', location)
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Handle calendar option selection
 * @param {string} calendarType - Type of calendar (google, apple, outlook, ical)
 * @param {Object} eventData - Event data object
 */
export async function handleCalendarSelection(calendarType, eventData) {
  switch (calendarType) {
    case 'google':
      const googleUrl = getGoogleCalendarUrl(eventData)
      if (googleUrl) {
        window.open(googleUrl, '_blank')
      }
      break
    
    case 'apple':
    case 'outlook':
    case 'ical':
      await downloadIcsFile(eventData)
      break
    
    default:
      logger.error('[CalendarService]', 'Unknown calendar type:', calendarType)
  }
}

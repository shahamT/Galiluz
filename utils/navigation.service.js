/**
 * Opens a navigation app (Waze / Google Maps) for the given location.
 * Uses a direct nav link when available, otherwise falls back to a search deep link.
 */
export function handleNavigationSelection(navType, location) {
  if (!location) return

  const queryParts = []
  if (location.locationName) queryParts.push(location.locationName)
  if (location.addressLine1) queryParts.push(location.addressLine1)
  if (location.addressLine2) queryParts.push(location.addressLine2)
  if (location.city) queryParts.push(location.city)
  const query = encodeURIComponent(queryParts.join(', '))

  let url
  if (navType === 'waze') {
    url = location.wazeNavLink || `https://waze.com/ul?q=${query}&navigate=yes`
  } else if (navType === 'gmaps') {
    url = location.gmapsNavLink || `https://www.google.com/maps/search/?api=1&query=${query}`
  }

  if (url) window.open(url, '_blank')
}

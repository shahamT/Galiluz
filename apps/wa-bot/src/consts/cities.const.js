/**
 * Cities list for event-add flow (from regions.const – single source of truth).
 * Format: [{ id, title, region }] for normalizeCityToListedOrCustom.
 */
import { CITIES } from '../../../../consts/regions.const.js'

export const CITIES_LIST = Object.entries(CITIES).map(([id, v]) => ({
  id,
  title: v?.title ?? '',
  region: v?.region ?? '',
}))

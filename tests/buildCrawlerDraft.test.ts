import { describe, it, expect } from 'vitest'
import { buildCrawlerDraftEvent } from '~/server/utils/buildCrawlerDraft'

// Minimal complete formattedEvent (as the @galiluz/event-format extractor returns):
// Title + ≥1 occurrence (date + ISO startTime) + a location with a city. Categories
// are intentionally empty so we also confirm the normalizer fills the fallback.
function completeEvent(overrides: Record<string, unknown> = {}) {
  return {
    Title: 'מופע מוזיקה בגליל',
    shortDescription: 'ערב מוזיקלי',
    fullDescription: '<p>בואו לחגוג</p>',
    categories: [],
    occurrences: [{ date: '2026-07-01', hasTime: true, startTime: '2026-07-01T18:00:00Z' }],
    location: { city: 'מעלות' },
    price: null,
    urls: [],
    ...overrides,
  }
}

describe('buildCrawlerDraftEvent', () => {
  it('builds a validDraft:true event from a complete message', () => {
    const { eventObj, validDraft } = buildCrawlerDraftEvent(completeEvent(), 'pub-1')
    expect(validDraft).toBe(true)
    expect(eventObj.Title).toBe('מופע מוזיקה בגליל')
    expect(eventObj.publisherId).toBe('pub-1')
    expect(eventObj.originalCreatorPublisherId).toBe('pub-1')
    // normalizer fills a fallback category when none are valid
    expect(Array.isArray(eventObj.categories)).toBe(true)
    expect((eventObj.categories as string[]).length).toBeGreaterThan(0)
    expect(eventObj.mainCategory).toBe((eventObj.categories as string[])[0])
  })

  it('flags validDraft:false when occurrences are missing (saved anyway, never rejected)', () => {
    const { eventObj, validDraft } = buildCrawlerDraftEvent(completeEvent({ occurrences: [] }), 'pub-1')
    expect(validDraft).toBe(false)
    expect(eventObj.Title).toBe('מופע מוזיקה בגליל') // still built — publisher can complete it
  })

  it('flags validDraft:false when Title is empty', () => {
    const { validDraft } = buildCrawlerDraftEvent(completeEvent({ Title: '' }), 'pub-1')
    expect(validDraft).toBe(false)
  })

  it('flags validDraft:false when neither city nor locationName is present', () => {
    const { validDraft } = buildCrawlerDraftEvent(completeEvent({ location: {} }), 'pub-1')
    expect(validDraft).toBe(false)
  })

  it('strips HTML from the Title and sanitizes descriptions', () => {
    const { eventObj } = buildCrawlerDraftEvent(completeEvent({ Title: '<b>מופע</b>' }), 'pub-1')
    expect(eventObj.Title).toBe('מופע')
  })

  it('attaches provided media and defaults to an empty array', () => {
    const media = [{ cloudinaryURL: 'https://x/y.jpg', isMain: true }]
    expect(buildCrawlerDraftEvent(completeEvent(), 'pub-1', media).eventObj.media).toEqual(media)
    expect(buildCrawlerDraftEvent(completeEvent(), 'pub-1').eventObj.media).toEqual([])
  })
})

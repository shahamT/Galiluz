import { describe, it, expect } from 'vitest'
import {
  SEO_KEYWORDS,
  SEO_KEYWORDS_STRING,
  SEO_DEFAULT_DESCRIPTION,
  SEO_PAGES,
  SITE_NAME_ALT,
  buildSiteJsonLd,
} from '~/consts/seo.const'

const BASE_URL = 'https://galiluz.co.il'

const USER_KEYWORDS = [
  'גלילוז',
  'גלילו"ז אירועים בצפון',
  'אירועים בגולן',
  'אירועים בגליל',
  'מסיבות בצפון',
  'מסיבות בגולן',
  'מסיבות בגליל',
  'מה עושים בצפון',
  'מה קורה בצפון',
]

describe('SEO_KEYWORDS', () => {
  it('includes all user-provided phrases', () => {
    for (const phrase of USER_KEYWORDS) {
      expect(SEO_KEYWORDS).toContain(phrase)
    }
  })

  it('produces a deduplicated comma-separated string', () => {
    const parts = SEO_KEYWORDS_STRING.split(', ').map((s) => s.trim())
    expect(parts.length).toBe(new Set(parts).size)
    expect(parts.length).toBeGreaterThan(0)
  })
})

describe('SEO_PAGES descriptions', () => {
  it('keeps descriptions concise for search snippets', () => {
    for (const page of Object.values(SEO_PAGES)) {
      expect(page.description.length).toBeLessThanOrEqual(180)
      expect(page.title.length).toBeGreaterThan(0)
    }
  })
})

describe('buildSiteJsonLd', () => {
  it('returns WebSite and Organization schemas with alternate names', () => {
    const schemas = buildSiteJsonLd(BASE_URL)
    expect(schemas).toHaveLength(2)

    const website = schemas[0]
    const organization = schemas[1]

    expect(website['@type']).toBe('WebSite')
    expect(website.alternateName).toEqual(SITE_NAME_ALT)
    expect(website.url).toBe(BASE_URL)
    expect(website.description).toBe(SEO_DEFAULT_DESCRIPTION)
    expect(website.inLanguage).toBe('he')

    expect(organization['@type']).toBe('Organization')
    expect(organization.alternateName).toEqual(SITE_NAME_ALT)
    expect(organization.logo).toBe(`${BASE_URL}/galiluz-thumbnail.png`)
    expect(organization.areaServed).toEqual({
      '@type': 'Place',
      name: 'גליל והגולן, ישראל',
    })
  })

  it('strips trailing slash from base URL', () => {
    const schemas = buildSiteJsonLd(`${BASE_URL}/`)
    expect(schemas[0].url).toBe(BASE_URL)
    expect(schemas[1].logo).toBe(`${BASE_URL}/galiluz-thumbnail.png`)
  })

  it('serializes to valid JSON', () => {
    expect(() => JSON.stringify(buildSiteJsonLd(BASE_URL))).not.toThrow()
  })
})

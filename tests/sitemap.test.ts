import { describe, it, expect } from 'vitest'
import {
  SITEMAP_STATIC_PATHS,
  ROBOTS_DISALLOW_PATHS,
  buildEventSitemapUrl,
  buildRobotsTxt,
  buildSitemapXml,
  buildStaticSitemapEntries,
  escapeXml,
  formatLastmod,
  getSiteBaseUrl,
} from '~/server/utils/sitemap'

const BASE_URL = 'https://galiluz.co.il'

describe('getSiteBaseUrl', () => {
  it('returns default when siteUrl is unset', () => {
    expect(getSiteBaseUrl({ public: {} })).toBe('https://galiluz.co.il')
  })

  it('strips trailing slash from configured siteUrl', () => {
    expect(getSiteBaseUrl({ public: { siteUrl: 'https://galiluz.co.il/' } })).toBe(
      'https://galiluz.co.il',
    )
  })
})

describe('formatLastmod', () => {
  it('formats Date to YYYY-MM-DD', () => {
    expect(formatLastmod(new Date('2026-06-10T15:30:00.000Z'))).toBe('2026-06-10')
  })

  it('returns undefined for invalid values', () => {
    expect(formatLastmod(undefined)).toBeUndefined()
    expect(formatLastmod('not-a-date')).toBeUndefined()
  })
})

describe('buildEventSitemapUrl', () => {
  it('builds canonical /direct?event= link', () => {
    expect(buildEventSitemapUrl(BASE_URL, '674a1b2c3d4e5f6789012345')).toBe(
      'https://galiluz.co.il/direct?event=674a1b2c3d4e5f6789012345',
    )
  })
})

describe('buildStaticSitemapEntries', () => {
  it('includes all static public paths', () => {
    const entries = buildStaticSitemapEntries(BASE_URL, '2026-06-12')
    expect(entries).toHaveLength(SITEMAP_STATIC_PATHS.length)
    for (const { path } of SITEMAP_STATIC_PATHS) {
      expect(entries.some((entry) => entry.loc === `${BASE_URL}${path}`)).toBe(true)
    }
  })
})

describe('escapeXml', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })
})

describe('buildRobotsTxt', () => {
  it('disallows API, auth, and portal routes', () => {
    const robots = buildRobotsTxt(BASE_URL)
    for (const path of ROBOTS_DISALLOW_PATHS) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
  })

  it('allows public pages and points to the sitemap', () => {
    const robots = buildRobotsTxt(BASE_URL)
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Sitemap: https://galiluz.co.il/sitemap.xml')
  })
})

describe('buildSitemapXml', () => {
  it('produces valid urlset with declaration and static pages', () => {
    const xml = buildSitemapXml([
      ...buildStaticSitemapEntries(BASE_URL, '2026-06-12'),
      {
        loc: buildEventSitemapUrl(BASE_URL, '674a1b2c3d4e5f6789012345'),
        lastmod: '2026-06-10',
        changefreq: 'weekly',
        priority: 0.7,
      },
    ])

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('<loc>https://galiluz.co.il/events/daily-view</loc>')
    expect(xml).toContain('<loc>https://galiluz.co.il/direct?event=674a1b2c3d4e5f6789012345</loc>')
    expect(xml).toContain('<lastmod>2026-06-10</lastmod>')
    expect(xml).toContain('<priority>0.7</priority>')
  })

  it('escapes special characters in loc values', () => {
    const xml = buildSitemapXml([{ loc: 'https://example.com/path?a=1&amp;b=2' }])
    expect(xml).toContain('<loc>https://example.com/path?a=1&amp;amp;b=2</loc>')
  })
})

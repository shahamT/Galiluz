import { getMongoConnection } from '~/server/utils/mongodb'
import { NOT_DELETED } from '~/server/utils/eventsQuery'
import { getIsraelDayUtcRange } from '~/server/utils/israelDateRange'
import { getTodayIsrael } from '~/server/utils/eventFirstOccurrence'

export type SitemapEntry = {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

export const SITEMAP_STATIC_PATHS: Array<{
  path: string
  changefreq: string
  priority: number
}> = [
  { path: '/events/daily-view', changefreq: 'daily', priority: 1.0 },
  { path: '/events/monthly-view', changefreq: 'daily', priority: 0.9 },
  { path: '/about', changefreq: 'monthly', priority: 0.6 },
  { path: '/publish-events', changefreq: 'monthly', priority: 0.6 },
  { path: '/terms-of-service', changefreq: 'yearly', priority: 0.4 },
]

const DEFAULT_SITE_URL = 'https://galiluz.co.il'

/** Paths crawlers should not index (auth, API, internal). */
export const ROBOTS_DISALLOW_PATHS = ['/api/', '/publisher/', '/admin/', '/login'] as const

export function getSiteBaseUrl(config: { public?: { siteUrl?: string } }): string {
  const url = config.public?.siteUrl?.trim()
  if (!url) return DEFAULT_SITE_URL
  return url.replace(/\/$/, '')
}

export function buildRobotsTxt(baseUrl: string): string {
  const lines = [
    'User-agent: *',
    ...ROBOTS_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ]
  return `${lines.join('\n')}\n`
}

export function formatLastmod(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

export function buildEventSitemapUrl(baseUrl: string, docId: string): string {
  const params = new URLSearchParams({ event: docId })
  return `${baseUrl}/direct?${params.toString()}`
}

export function buildStaticSitemapEntries(baseUrl: string, lastmod?: string): SitemapEntry[] {
  const today = lastmod ?? new Date().toISOString().slice(0, 10)
  return SITEMAP_STATIC_PATHS.map(({ path, changefreq, priority }) => ({
    loc: `${baseUrl}${path}`,
    lastmod: today,
    changefreq,
    priority,
  }))
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`]
      if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
      if (entry.changefreq) parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`)
      if (entry.priority != null) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n')
}

function buildSitemapEventsQuery(): Record<string, unknown> | null {
  const todayRange = getIsraelDayUtcRange(getTodayIsrael())
  if (!todayRange) return null

  return {
    $and: [
      { isActive: true },
      { ...NOT_DELETED },
      { event: { $ne: null } },
      { 'event.occurrences.startTime': { $gte: todayRange.startUTC.toISOString() } },
    ],
  }
}

export async function getSitemapEventEntries(baseUrl: string): Promise<SitemapEntry[]> {
  const config = useRuntimeConfig()
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI
  const mongoDbName = config.mongodbDbName || process.env.MONGODB_DB_NAME
  const collectionName =
    config.mongodbCollectionEvents || process.env.MONGODB_COLLECTION_EVENTS || 'events'

  if (!mongoUri || !mongoDbName) {
    return []
  }

  const query = buildSitemapEventsQuery()
  if (!query) return []

  const { db } = await getMongoConnection()
  const collection = db.collection(collectionName)
  const documents = await collection
    .find(query, { projection: { _id: 1, updatedAt: 1, createdAt: 1 } })
    .toArray()

  return documents.map((doc) => ({
    loc: buildEventSitemapUrl(baseUrl, String(doc._id)),
    lastmod: formatLastmod(doc.updatedAt ?? doc.createdAt),
    changefreq: 'weekly',
    priority: 0.7,
  }))
}

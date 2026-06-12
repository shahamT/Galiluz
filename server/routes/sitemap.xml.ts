import {
  buildSitemapXml,
  buildStaticSitemapEntries,
  getSiteBaseUrl,
  getSitemapEventEntries,
} from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl = getSiteBaseUrl(config)
  const staticEntries = buildStaticSitemapEntries(baseUrl)

  let eventEntries = []
  try {
    eventEntries = await getSitemapEventEntries(baseUrl)
  } catch (error) {
    console.error(
      '[Sitemap] Failed to load event entries:',
      error instanceof Error ? error.message : String(error),
    )
  }

  const xml = buildSitemapXml([...staticEntries, ...eventEntries])
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})

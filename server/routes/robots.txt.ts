import { buildRobotsTxt, getSiteBaseUrl } from '~/server/utils/sitemap'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const baseUrl = getSiteBaseUrl(config)
  const body = buildRobotsTxt(baseUrl)
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return body
})

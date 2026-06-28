import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * ONE-TIME MIGRATION — DELETE THIS FILE ON THE NEXT DEPLOY (after it has run once on prod).
 *
 * Crawler auto-drafts created before the "default undetermined price to free (0)" fix
 * (server/utils/buildCrawlerDraft.ts) were stored with event.price = null and render as
 * "מחיר לא ידוע". This stamps those specific crawler drafts (rawEvent.source =
 * 'whatsapp_crawler') to free (0 → כניסה חופשית), matching the new behavior.
 *
 * Genuinely-legacy events (any other / unknown source) are LEFT as null ON PURPOSE — the
 * frontend renders those as "מחיר לא ידוע" (see utils/events.helpers.js formatEventPrice).
 *
 * Marker-guarded via appSettings so it runs exactly once; the updateMany is idempotent
 * anyway (it only matches null/missing prices, so a re-run is a no-op).
 */
const MARKER = 'migration:crawler-null-price-to-free'

export default defineNitroPlugin(() => {
  // Fire and forget — never block startup; a failure just leaves the marker unset
  // so the next deploy retries (idempotent).
  run().catch((err) =>
    console.error('[migrate:crawlerPrice] failed:', err instanceof Error ? err.message : err),
  )
})

async function run() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const appSettings = db.collection(config.mongodbCollectionAppSettings || 'appSettings')

  const existing = await appSettings.findOne({ key: MARKER })
  if (existing?.done) {
    console.info('[migrate:crawlerPrice] already applied — skipping')
    return
  }

  const events = db.collection(
    config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events',
  )
  const filter = {
    'rawEvent.source': 'whatsapp_crawler',
    $or: [{ 'event.price': null }, { 'event.price': { $exists: false } }],
  }
  const result = await events.updateMany(filter, {
    $set: { 'event.price': 0, updatedAt: new Date() },
  })

  await appSettings.updateOne(
    { key: MARKER },
    {
      $set: {
        key: MARKER,
        done: true,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        ranAt: new Date(),
      },
    },
    { upsert: true },
  )
  console.info(
    `[migrate:crawlerPrice] set price=0 (free) on ${result.modifiedCount} crawler drafts (matched ${result.matchedCount}); legacy null-price events left untouched`,
  )
}

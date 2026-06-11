import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * ONE-TIME DATA MIGRATIONS — runs automatically at server startup.
 *
 * Idempotent (re-runs find nothing to do), so it is safe across restarts.
 * DELETE THIS FILE after the first production deploy confirms in the logs:
 *   [Migration] startTime: ...
 *   [Migration] stats: ...
 * (Standalone equivalents for ad-hoc runs: scripts/migrate-starttime.js,
 *  scripts/cleanup-orphan-stats.js.)
 */
export default defineNitroPlugin(() => {
  runMigrations().catch((err) => {
    console.error('[Migration] First attempt failed, retrying in 10s:', err instanceof Error ? err.message : err)
    setTimeout(() => {
      runMigrations().catch((err2) => {
        console.error('[Migration] Retry failed:', err2 instanceof Error ? err2.message : err2)
      })
    }, 10_000)
  })
})

async function runMigrations() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()

  const eventsCol = db.collection(config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events')
  const statsCollections = [
    config.mongodbCollectionEventStats || 'eventStats',
    config.mongodbCollectionEventOccurrenceStats || 'eventOccurrenceStats',
    config.mongodbCollectionEventInteractions || 'eventInteractions',
  ]

  // ── 1. Normalize occurrences.startTime/endTime: BSON Date → ISO string ────
  const docs = await eventsCol.find(
    { 'event.occurrences': { $exists: true, $ne: [] } },
    { projection: { 'event.occurrences': 1 } },
  ).toArray()

  let migratedTimes = 0
  for (const doc of docs) {
    const occs = doc.event?.occurrences || []
    const needsFix = occs.some((o: any) => o?.startTime instanceof Date || o?.endTime instanceof Date)
    if (!needsFix) continue
    const fixed = occs.map((o: any) => {
      const out = { ...o }
      if (out.startTime instanceof Date) out.startTime = out.startTime.toISOString()
      if (out.endTime instanceof Date) out.endTime = out.endTime.toISOString()
      return out
    })
    await eventsCol.updateOne({ _id: doc._id }, { $set: { 'event.occurrences': fixed } })
    migratedTimes++
  }
  console.info(`[Migration] startTime: ${migratedTimes} events normalized to ISO strings (${docs.length} scanned)`)

  // ── 2. Stats hygiene: stamp orphans + sweep soft-delete stragglers ────────
  const allEvents = await eventsCol.find({}, { projection: { _id: 1, deletedAt: 1 } }).toArray()
  const eventIds = allEvents.map((d) => d._id.toString())
  const softDeletedIds = allEvents.filter((d) => d.deletedAt).map((d) => d._id.toString())

  const deletedAt = new Date()
  let orphaned = 0
  let swept = 0
  for (const colName of statsCollections) {
    const col = db.collection(colName)
    const o = await col.updateMany(
      { eventId: { $nin: eventIds }, deletedAt: { $exists: false } },
      { $set: { deletedAt, orphaned: true } },
    )
    orphaned += o.modifiedCount
    if (softDeletedIds.length) {
      const s = await col.updateMany(
        { eventId: { $in: softDeletedIds }, deletedAt: { $exists: false } },
        { $set: { deletedAt } },
      )
      swept += s.modifiedCount
    }
  }
  console.info(`[Migration] stats: ${orphaned} orphaned rows stamped, ${swept} soft-delete stragglers swept`)
}

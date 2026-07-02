import { ObjectId } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'

/**
 * ONE-TIME MIGRATION — DELETE THIS FILE ON THE NEXT DEPLOY (after it has run once on prod).
 *
 * The account-merge cleanup left 4 events with owner/account inconsistencies (invisible in the
 * public calendar — all past/inactive — but "ownerless" in the admin list). This restores each,
 * matching the repair already applied to the dev clone (scripts/fix-orphan-event-owners.js):
 *   - 3 events lost event.publisherId/accountId → re-stamp both + backfill rawEvent.publisher.
 *   - 1 event ("ג'אם אקרו ותנועה") had publisherId=Galiluz but accountId=שחם's account → reassign
 *     its publisherId to שחם (owner's decision), keeping the account.
 *
 * Targets are pinned by event `_id` and publisher `_id` — both stable across the prod->dev clone —
 * so the same rows are hit in prod. The TARGET ACCOUNT is resolved FRESH from the publisher's
 * current `accountId` (account follows the publisher). Marker-guarded via appSettings + per-event
 * idempotent guards, so a re-run is a no-op.
 */
const MARKER = 'migration:orphan-event-owners'

// eventId -> the publisher that should own it (stable _id). `keepAccount` = reassign publisherId
// only and leave the existing event.accountId in place (the reassignment case).
const TARGETS = [
  { event: '6a198ce0f156b2237df8c132', publisher: '6a248e9f2497f26f10680b61' }, // "יריד היין ראש פינה" → מיקי נירון
  { event: '6a19c67e60993da3c5285904', publisher: '6a19db4c7e7b63c375daae22' }, // "מפגש קהילתי"
  { event: '6a1ad4e7fb8d61287a349f8b', publisher: '6a1c91e87e7b63c375daf6bd' }, // "הופעת רוקנרול" → איל קולמן
  { event: '6a19f4837e1b109bdf27e52d', publisher: '6a1de64b5fd432193b4107fa', keepAccount: true }, // "ג'אם אקרו" → שחם
]

export default defineNitroPlugin(() => {
  // Fire and forget — never block startup; a failure just leaves the marker unset so the next
  // deploy retries (the per-event guards keep it idempotent).
  run().catch((err) =>
    console.error('[migrate:orphanOwners] failed:', err instanceof Error ? err.message : err),
  )
})

async function run() {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  const appSettings = db.collection(config.mongodbCollectionAppSettings || 'appSettings')

  const existing = await appSettings.findOne({ key: MARKER })
  if (existing?.done) {
    console.info('[migrate:orphanOwners] already applied — skipping')
    return
  }

  const events = db.collection(
    config.mongodbCollectionEventsWaBot || config.mongodbCollectionEvents || 'events',
  )
  const publishers = db.collection(config.mongodbCollectionPublishers || 'publishers')

  let fixed = 0
  for (const t of TARGETS) {
    try {
      const ev = await events.findOne({ _id: new ObjectId(t.event) })
      if (!ev) {
        console.warn(`[migrate:orphanOwners] event ${t.event} not found — skipping`)
        continue
      }
      const pub = await publishers.findOne(
        { _id: new ObjectId(t.publisher) },
        { projection: { accountId: 1, fullName: 1 } },
      )
      if (!pub) {
        console.warn(`[migrate:orphanOwners] publisher ${t.publisher} not found — skipping ${t.event}`)
        continue
      }

      if (t.keepAccount) {
        // Reassignment: only if the mismatch is still present (publisherId not already the target).
        if (String(ev.event?.publisherId) === t.publisher) continue
        await events.updateOne({ _id: ev._id }, { $set: { 'event.publisherId': t.publisher } })
        fixed++
        console.info(`[migrate:orphanOwners] reassigned ${t.event} → ${pub.fullName || t.publisher}`)
      } else {
        // Ownerless event: only if still missing accountId (idempotent).
        if (ev.event?.accountId) continue
        const accountId = pub.accountId ? String(pub.accountId) : ''
        if (!accountId) {
          console.warn(`[migrate:orphanOwners] publisher ${t.publisher} has no accountId — skipping ${t.event}`)
          continue
        }
        await events.updateOne(
          { _id: ev._id },
          {
            $set: {
              'event.publisherId': t.publisher,
              'event.accountId': accountId,
              'rawEvent.publisher.publisherId': t.publisher,
            },
          },
        )
        fixed++
        console.info(`[migrate:orphanOwners] set owner on ${t.event} → ${pub.fullName || t.publisher} / account ${accountId}`)
      }
    } catch (e) {
      console.error(`[migrate:orphanOwners] error on ${t.event}:`, e instanceof Error ? e.message : e)
    }
  }

  await appSettings.updateOne(
    { key: MARKER },
    { $set: { key: MARKER, done: true, fixed, ranAt: new Date() } },
    { upsert: true },
  )
  console.info(`[migrate:orphanOwners] done — ${fixed} event(s) repaired`)
}

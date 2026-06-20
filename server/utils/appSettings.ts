import { getMongoConnection } from '~/server/utils/mongodb'
import type { Collection } from 'mongodb'

/**
 * Global app settings — one document per settings domain, keyed by `key`
 * (e.g. 'crawler'). A generic, extensible "managing data" store, distinct from
 * account-level entitlements and per-publisher preferences.
 */
export async function getAppSettingsCollection(): Promise<Collection> {
  const config = useRuntimeConfig() as Record<string, string>
  const { db } = await getMongoConnection()
  return db.collection(config.mongodbCollectionAppSettings || 'appSettings')
}

/** Read a settings doc by key (null if not yet created). */
export async function getAppSetting(key: string): Promise<Record<string, unknown> | null> {
  const col = await getAppSettingsCollection()
  return (await col.findOne({ key })) as Record<string, unknown> | null
}

/**
 * Upsert scalar/object fields onto a settings doc (does NOT replace array fields
 * wholesale — manage arrays like `groups` with targeted $push/$pull instead).
 */
export async function setAppSetting(
  key: string,
  patch: Record<string, unknown>,
  actorPublisherId?: string,
): Promise<void> {
  const col = await getAppSettingsCollection()
  await col.updateOne(
    { key },
    {
      $set: { ...patch, updatedAt: new Date(), updatedBy: actorPublisherId || null },
      $setOnInsert: { key, createdAt: new Date() },
    },
    { upsert: true },
  )
}

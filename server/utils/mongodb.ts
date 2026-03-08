import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

/**
 * Returns DB-related config values from runtimeConfig.
 * Single source of truth — avoids redundant process.env lookups in route files.
 */
export function getDbConfig() {
  const config = useRuntimeConfig()
  return {
    uri: config.mongodbUri as string | undefined,
    dbName: config.mongodbDbName as string | undefined,
    collections: {
      events: config.mongodbCollectionEvents as string,
      eventsWaBot: config.mongodbCollectionEventsWaBot as string,
      rawMessages: config.mongodbCollectionRawMessages as string,
      publishers: config.mongodbCollectionPublishers as string,
      eventLogs: config.mongodbCollectionEventLogs as string,
    },
  }
}

export async function getMongoConnection() {
  if (client && db) {
    return { client, db }
  }

  const { uri, dbName } = getDbConfig()

  if (!uri || !dbName) {
    throw new Error('MongoDB configuration missing: MONGODB_URI and MONGODB_DB_NAME are required')
  }

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  })
  await client.connect()
  db = client.db(dbName)

  return { client, db }
}

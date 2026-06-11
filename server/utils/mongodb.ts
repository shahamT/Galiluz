import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function getMongoConnection() {
  if (client && db) {
    return { client, db }
  }

  const config = useRuntimeConfig()
  const uri = config.mongodbUri || process.env.MONGODB_URI
  const dbName = config.mongodbDbName || process.env.MONGODB_DB_NAME

  if (!uri || !dbName) {
    throw new Error('MongoDB configuration missing: MONGODB_URI and MONGODB_DB_NAME are required')
  }

  client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    retryWrites: true,
    retryReads: true,
  })
  await client.connect()
  db = client.db(dbName)

  return { client, db }
}

/**
 * Migration: add type: 'publisher' to all existing publisher records that don't have a type field.
 * Run once: node scripts/set-publisher-types.js
 * Managers must be set manually in the DB: { type: 'manager' }
 */
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { MongoClient } from 'mongodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
const collectionName = process.env.MONGODB_COLLECTION_PUBLISHERS || 'publishers'

if (!uri || !dbName) {
  console.error('Missing MONGODB_URI or MONGODB_DB_NAME in .env')
  process.exit(1)
}

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db(dbName)
  const col = db.collection(collectionName)

  const result = await col.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'publisher' } },
  )

  console.log(`✅ Updated ${result.modifiedCount} publisher record(s) with type: 'publisher'`)
  console.log('   To set a manager (must have BOTH fields):')
  console.log('   db.publishers.updateOne({ waId: "..." }, { $set: { type: "manager", status: "approved" } })')
  console.log('   Note: a manager record must have status:"approved" to be recognised by the bot.')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.close()
}

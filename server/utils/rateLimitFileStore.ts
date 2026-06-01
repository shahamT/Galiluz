import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export type RateLimitEntry = { count: number; resetAt: number }

let writeQueue: Promise<void> = Promise.resolve()

/**
 * Reads rate limit state from a JSON file. Returns empty object if file missing or invalid.
 * Prunes entries whose resetAt has passed.
 */
export async function readRateLimitFile(filePath: string): Promise<Record<string, RateLimitEntry>> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, RateLimitEntry>
    const now = Date.now()
    const pruned: Record<string, RateLimitEntry> = {}
    for (const [key, entry] of Object.entries(data)) {
      if (entry && typeof entry.count === 'number' && typeof entry.resetAt === 'number' && entry.resetAt >= now) {
        pruned[key] = entry
      }
    }
    return pruned
  } catch {
    return {}
  }
}

/**
 * Writes rate limit state to a JSON file. Serialized with a queue so concurrent writes don't corrupt.
 */
export async function writeRateLimitFile(filePath: string, data: Record<string, RateLimitEntry>): Promise<void> {
  const run = async () => {
    await mkdir(dirname(filePath), { recursive: true }).catch(() => {})
    await writeFile(filePath, JSON.stringify(data), 'utf-8')
  }
  writeQueue = writeQueue.then(run, run)
  await writeQueue
}

/**
 * Atomically reads, mutates via updater, and writes a single key.
 * The entire read-mutate-write runs inside the write queue so no two callers can interleave.
 * Returns the new entry for the key.
 */
export async function atomicUpdateEntry(
  filePath: string,
  key: string,
  updater: (current: RateLimitEntry | undefined) => RateLimitEntry,
): Promise<RateLimitEntry> {
  let result!: RateLimitEntry
  const run = async () => {
    await mkdir(dirname(filePath), { recursive: true }).catch(() => {})
    const data = await readRateLimitFile(filePath)
    result = updater(data[key])
    data[key] = result
    await writeFile(filePath, JSON.stringify(data), 'utf-8')
  }
  writeQueue = writeQueue.then(run, run)
  await writeQueue
  return result
}

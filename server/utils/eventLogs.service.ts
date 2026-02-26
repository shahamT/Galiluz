import { Collection } from 'mongodb'
import { getMongoConnection } from '~/server/utils/mongodb'

const LOG_PREFIX = '[EventLogs]'
const DEFAULT_COLLECTION = 'eventLogs'

export type EventLogActionCreation =
  | 'draft_created'
  | 'event_created'
  | 'draft_processed'
  | 'event_activated'
export type EventLogAction = EventLogActionCreation | 'event_edited' | 'event_deleted'

export interface EventLogCreationPayload {
  eventId: string
  action: EventLogActionCreation
  title?: string
  rawTitle?: string
  publisherId?: string
  waId?: string
  correlationId?: string
}

export interface EventLogEditPayload {
  eventId: string
  changedFields: string[]
  previous: { raw: Record<string, unknown>; final: Record<string, unknown> }
  new: { raw: Record<string, unknown>; final: Record<string, unknown> }
  publisherId?: string
  waId?: string
  correlationId?: string
}

export interface EventLogDeletionPayload {
  eventId: string
  /** 'kill' = draft/flow abandoned (e.g. timeout or cancel before completing add). 'user_deleted' = user chose to delete the event. */
  deletionType?: 'kill' | 'user_deleted'
  title?: string
  rawTitle?: string
  publisherId?: string
  waId?: string
  correlationId?: string
}

/**
 * Resolve the eventLogs collection. Uses config/env for collection name.
 */
export async function getEventLogsCollection(): Promise<Collection> {
  const config = useRuntimeConfig()
  const name =
    config.mongodbCollectionEventLogs ||
    process.env.MONGODB_COLLECTION_EVENT_LOGS ||
    DEFAULT_COLLECTION
  const { db } = await getMongoConnection()
  return db.collection(name)
}

/**
 * Insert a creation log (draft_created, event_created, draft_processed, event_activated).
 * Does not throw; logs errors so the main request still succeeds.
 */
export async function logEventCreation(payload: EventLogCreationPayload): Promise<void> {
  try {
    const collection = await getEventLogsCollection()
    const doc = {
      createdAt: new Date(),
      eventId: payload.eventId,
      action: payload.action,
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.rawTitle !== undefined && { rawTitle: payload.rawTitle }),
      ...(payload.publisherId !== undefined && { publisherId: payload.publisherId }),
      ...(payload.waId !== undefined && { waId: payload.waId }),
      ...(payload.correlationId !== undefined && { correlationId: payload.correlationId }),
    }
    await collection.insertOne(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, 'logEventCreation failed', payload.eventId, msg)
  }
}

/**
 * Insert an edit log with previous/new raw and final snapshots for changed fields only.
 * Does not throw; logs errors so the main request still succeeds.
 */
export async function logEventEdit(payload: EventLogEditPayload): Promise<void> {
  try {
    const collection = await getEventLogsCollection()
    const doc = {
      createdAt: new Date(),
      eventId: payload.eventId,
      action: 'event_edited' as const,
      changedFields: payload.changedFields,
      previous: payload.previous,
      new: payload.new,
      ...(payload.publisherId !== undefined && { publisherId: payload.publisherId }),
      ...(payload.waId !== undefined && { waId: payload.waId }),
      ...(payload.correlationId !== undefined && { correlationId: payload.correlationId }),
    }
    await collection.insertOne(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, 'logEventEdit failed', payload.eventId, msg)
  }
}

/**
 * Insert a deletion log (identifying details only).
 * Does not throw; logs errors so the main request still succeeds.
 */
export async function logEventDeletion(payload: EventLogDeletionPayload): Promise<void> {
  try {
    const collection = await getEventLogsCollection()
    const doc = {
      createdAt: new Date(),
      eventId: payload.eventId,
      action: 'event_deleted' as const,
      deletionType: payload.deletionType ?? 'user_deleted',
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.rawTitle !== undefined && { rawTitle: payload.rawTitle }),
      ...(payload.publisherId !== undefined && { publisherId: payload.publisherId }),
      ...(payload.waId !== undefined && { waId: payload.waId }),
      ...(payload.correlationId !== undefined && { correlationId: payload.correlationId }),
    }
    await collection.insertOne(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG_PREFIX, 'logEventDeletion failed', payload.eventId, msg)
  }
}

import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'

const VALID_TOPICS = ['bug', 'feature', 'content', 'general', 'other']

export default defineEventHandler(async (event) => {
  await checkRateLimit(event)

  const body = await readBody<{ topic?: string; content?: string }>(event)
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (!VALID_TOPICS.includes(topic))
    throw createError({ statusCode: 400, message: 'invalid_topic' })
  if (content.length < 10)
    throw createError({ statusCode: 400, message: 'content_too_short' })
  if (content.length > 2000)
    throw createError({ statusCode: 400, message: 'content_too_long' })

  const { db } = await getMongoConnection()
  await db.collection('feedback').insertOne({ topic, content, createdAt: new Date() })
  return { success: true }
})

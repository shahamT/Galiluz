import { getMongoConnection } from '~/server/utils/mongodb'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendNotificationMail } from '~/server/utils/mailer'

const VALID_TOPICS = ['bug', 'feature', 'content', 'general', 'other']

const TOPIC_LABELS: Record<string, string> = {
  bug: 'תקלה טכנית',
  feature: "בקשת פיצ'ר",
  content: 'תוכן שגוי באירוע',
  general: 'שאלה / הצעה',
  other: 'אחר',
}

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
  const createdAt = new Date()
  await db.collection('feedback').insertOne({ topic, content, createdAt })

  // Fire-and-forget owner notification — must never affect the response
  sendNotificationMail({
    subject: `משוב חדש מהאתר — ${TOPIC_LABELS[topic] || topic}`,
    text: `נושא: ${TOPIC_LABELS[topic] || topic}\nהתקבל: ${createdAt.toISOString()}\n\n${content}`,
  }).catch(() => {})

  return { success: true }
})

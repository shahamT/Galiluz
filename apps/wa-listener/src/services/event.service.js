import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { extractMessageId } from '../utils/messageHelpers.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { getCategoriesList } from '../consts/events.const.js'
import { validateEventStructure, validateSearchKeys } from './eventValidation.js'
import {
  callOpenAIForClassification,
  callOpenAIForComparison,
  callOpenAIForEvidenceLocator,
  callOpenAIForDescriptionBuilder,
} from './eventOpenAI.service.js'
import { enrichEvent } from './eventEnrichment.js'
import { updateEventDocument, updateSourceAndOcr, deleteEventDocument, findCandidateEvents } from './mongo.service.js'
import { sendEventConfirmation, CONFIRMATION_REASONS } from '../utils/messageSender.js'
import { deleteMediaFromCloudinary } from './cloudinary.service.js'
import { buildSourceDocument } from './sourceDocument.service.js'
import { runOcr } from './ocr.service.js'
import { buildOccurrences } from '../parsers/dateTimeParser.js'
import { verifyLocation } from '../parsers/locationVerifier.js'
import { parsePriceEvidence } from '../parsers/priceParser.js'

async function cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, reason, reasonDetail, sourceGroupId, sourceGroupName) {
  if (cloudinaryData?.public_id) {
    try { await deleteMediaFromCloudinary(cloudinaryData.public_id) } catch (_) { /* logged elsewhere */ }
  }
  try { await deleteEventDocument(eventId) } catch (_) { /* logged elsewhere */ }
  const context = {
    eventId: eventId?.toString?.() ?? String(eventId),
    sourceGroupId: sourceGroupId || undefined,
    sourceGroupName: sourceGroupName || undefined,
  }
  try { await sendEventConfirmation(messagePreview, reason, reasonDetail, context) } catch (_) { /* logged elsewhere */ }
}

function validatePipelineInputs(eventId, rawMessage, cloudinaryUrl, cloudinaryData) {
  if (!eventId) { logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Missing eventId'); return false }
  if (!rawMessage || typeof rawMessage !== 'object') { logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Invalid rawMessage'); return false }
  if (cloudinaryUrl !== null && typeof cloudinaryUrl !== 'string') { logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Invalid cloudinaryUrl'); return false }
  if (cloudinaryData !== null && (typeof cloudinaryData !== 'object' || Array.isArray(cloudinaryData))) { logger.error(LOG_PREFIXES.EVENT_SERVICE, 'Invalid cloudinaryData'); return false }
  return true
}

async function handleNewEvent(eventId, rawMessage, cloudinaryUrl, cloudinaryData, event, originalMessage, client, messagePreview, sourceGroupId, sourceGroupName) {
  logger.info(LOG_PREFIXES.EVENT_SERVICE, 'Handling new event — enriching and saving')
  const context = {
    eventId: eventId?.toString?.() ?? String(eventId),
    sourceGroupId: sourceGroupId || undefined,
    sourceGroupName: sourceGroupName || undefined,
  }
  try {
    const authorId = rawMessage.author || null
    const enrichedEvent = await enrichEvent(event, authorId, cloudinaryUrl, originalMessage, client)

    const updated = await updateEventDocument(eventId, enrichedEvent)
    if (updated) {
      logger.info(LOG_PREFIXES.EVENT_SERVICE, 'New event saved successfully')
      await sendEventConfirmation(messagePreview, CONFIRMATION_REASONS.NEW_EVENT, undefined, context)
    } else {
      await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.DATABASE_ERROR, undefined, sourceGroupId, sourceGroupName)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(LOG_PREFIXES.EVENT_SERVICE, `Error saving new event: ${errorMsg}`)
    const reason = errorMsg.includes('enrich') || errorMsg.includes('Invalid event') ? CONFIRMATION_REASONS.ENRICHMENT_ERROR : CONFIRMATION_REASONS.DATABASE_ERROR
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, reason, undefined, sourceGroupId, sourceGroupName)
  }
}

/**
 * Verification-first pipeline: Evidence Locator → deterministic parse/verify → Description Builder → Compare → Enrich → Save (or shadow log).
 */
async function processEventPipelineVerificationFirst(eventId, rawMessage, cloudinaryUrl, cloudinaryData, originalMessage, client, messageId, messagePreview, sourceGroupId, sourceGroupName) {
  const messageText = rawMessage.text || ''
  const messageTimestamp = rawMessage.t != null ? Number(rawMessage.t) : null

  let sourceDocument = buildSourceDocument(rawMessage, cloudinaryUrl, null)
  if (cloudinaryUrl && config.ocr?.enabled) {
    const ocrResult = await runOcr(cloudinaryUrl)
    if (ocrResult) {
      sourceDocument = buildSourceDocument(rawMessage, cloudinaryUrl, { fullText: ocrResult.fullText, blocks: ocrResult.blocks, lines: ocrResult.lines })
      await updateSourceAndOcr(eventId, sourceDocument, ocrResult.fullText, { fullText: ocrResult.fullText, blocks: ocrResult.blocks, lines: ocrResult.lines })
    }
  }

  const classification = await callOpenAIForClassification(messageText, cloudinaryUrl)
  if (!classification) {
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.AI_CLASSIFICATION_FAILED, undefined, sourceGroupId, sourceGroupName)
    return
  }
  if (!classification.isEvent) {
    const reason = classification.reason === 'multiple_events' || classification.reason?.includes('multiple')
      ? CONFIRMATION_REASONS.MULTIPLE_EVENTS
      : classification.reason?.includes('date')
        ? CONFIRMATION_REASONS.NO_DATE
        : CONFIRMATION_REASONS.NOT_EVENT
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, reason, undefined, sourceGroupId, sourceGroupName)
    return
  }

  const searchKeys = validateSearchKeys(classification.searchKeys) ? classification.searchKeys : []
  const candidates = await findCandidateEvents(searchKeys, eventId)
  const categoriesList = getCategoriesList()

  logger.info(LOG_PREFIXES.EVENT_SERVICE, `[Evidence Locator] ${messageId}`)
  const locatorResult = await callOpenAIForEvidenceLocator(sourceDocument)
  if (!locatorResult?.evidenceCandidates) {
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.EVIDENCE_LOCATOR_FAILED, 'Evidence locator failed', sourceGroupId, sourceGroupName)
    return
  }

  const evidence = locatorResult.evidenceCandidates
  const dateQuotes = (evidence.date || []).map((c) => (c?.quote ?? '').trim())
  const timeQuotes = (evidence.timeOfDay || []).map((c) => (c?.quote ?? '').trim())
  const locationQuotes = (evidence.location || []).map((c) => (c?.quote ?? '').trim())
  const priceQuotes = (evidence.price || []).map((c) => (c?.quote ?? '').trim())
  logger.info(LOG_PREFIXES.EVENT_SERVICE, `Evidence Locator result: date=${dateQuotes.length} [${dateQuotes.join(' | ')}], timeOfDay=${timeQuotes.length} [${timeQuotes.join(' | ')}], location=${locationQuotes.length} [${locationQuotes.slice(0, 3).join(' | ')}], price=${priceQuotes.length} [${priceQuotes.slice(0, 3).join(' | ')}]`)

  const occurrences = buildOccurrences(evidence.date || [], evidence.timeOfDay || [], messageTimestamp)
  if (!occurrences.length) {
    const dateCandidates = evidence.date || []
    const timeCandidates = evidence.timeOfDay || []
    const msgSnippet = (sourceDocument.messageTextSanitized || '').slice(0, 250)
    const ocrSnippet = (sourceDocument.ocrText || '').slice(0, 400)
    logger.warn(LOG_PREFIXES.EVENT_SERVICE, `Validation failed: No verified date. dateCandidates=${dateCandidates.length} [${dateCandidates.map((c) => c?.quote ?? '').join(' | ')}], timeCandidates=${timeCandidates.length}, messageTimestamp=${messageTimestamp}`)
    logger.warn(LOG_PREFIXES.EVENT_SERVICE, `Source for verification: messageText(250)=${msgSnippet || '(empty)'}, ocrText(400)=${ocrSnippet || '(no OCR)'}`)
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.VALIDATION_FAILED, 'No verified date', sourceGroupId, sourceGroupName)
    return
  }

  const locationResult = verifyLocation(evidence.location || [], sourceDocument.extractedUrls || [])
  const priceResult = parsePriceEvidence(evidence.price || [])

  const verificationReport = {
    date: { candidates: evidence.date || [], chosen: occurrences.length > 1 ? `${occurrences[0]?.date}…${occurrences[occurrences.length - 1]?.date}` : (occurrences[0]?.date ?? null), reasonChosen: occurrences[0]?.evidenceQuote || 'parsed from evidence' },
    timeOfDay: { candidates: evidence.timeOfDay || [], chosen: occurrences[0]?.startTime ?? null, reasonChosen: occurrences[0]?.evidenceQuote || 'parsed' },
    location: { candidates: evidence.location || [], chosen: locationResult, reasonChosen: locationResult.evidenceQuote || 'verified' },
    price: { candidates: evidence.price || [], chosen: priceResult.price, reasonChosen: priceResult.evidenceQuote || 'parsed' },
    needsReview: !locationResult.verified || (priceResult.price !== null && !priceResult.verified),
  }

  logger.info(LOG_PREFIXES.EVENT_SERVICE, `[Description Builder] ${messageId}`)
  const descResult = await callOpenAIForDescriptionBuilder(
    sourceDocument,
    { occurrences, location: locationResult, price: priceResult.price },
    categoriesList
  )
  if (!descResult) {
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.AI_COMPARISON_FAILED, 'Description builder failed', sourceGroupId, sourceGroupName)
    return
  }

  const locationShape = {
    City: locationResult.City,
    CityEvidence: locationResult.CityEvidence,
    addressLine1: locationResult.addressLine1,
    addressLine2: locationResult.addressLine2,
    locationDetails: locationResult.locationDetails,
    wazeNavLink: locationResult.wazeNavLink,
    gmapsNavLink: locationResult.gmapsNavLink,
  }

  const mainCat = descResult.mainCategory || categoriesList[0]?.id || 'community_meetup'
  const cats = Array.isArray(descResult.categories) && descResult.categories.length > 0 ? descResult.categories : [mainCat]
  if (!cats.includes(mainCat)) cats.push(mainCat)

  const event = {
    Title: descResult.Title,
    shortDescription: descResult.shortDescription,
    fullDescription: descResult.fullDescription,
    categories: cats,
    mainCategory: mainCat,
    location: locationShape,
    price: priceResult.price,
    occurrences,
    media: [],
    urls: (descResult.urls || []).map((u) => ({
      Title: u.Title,
      Url: u.Url,
      type: u.type === 'phone' ? 'phone' : 'link',
    })),
    justifications: {
      date: occurrences[0]?.evidenceQuote || 'Not stated in message or image.',
      location: locationResult.evidenceQuote || 'Not stated in message or image.',
      startTime: occurrences[0]?.evidenceQuote || 'Not stated in message or image.',
      endTime: 'Not stated in message or image.',
      price: priceResult.evidenceQuote || 'Not stated in message or image.',
    },
    verificationReport,
    needsReview: verificationReport.needsReview,
  }

  const structureCheck = validateEventStructure(event)
  if (!structureCheck.valid) {
    logger.warn(LOG_PREFIXES.EVENT_SERVICE, `Validation failed: structure. reason=${structureCheck.reason}. Title=${event.Title ?? ''}, occurrences.length=${event.occurrences?.length ?? 0}, firstOcc=${event.occurrences?.[0] ? JSON.stringify(event.occurrences[0]) : 'none'}`)
    await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.VALIDATION_FAILED, structureCheck.reason, sourceGroupId, sourceGroupName)
    return
  }

  if (candidates && candidates.length > 0) {
    const comparison = await callOpenAIForComparison(event, messageText, candidates)
    if (comparison && (comparison.status === 'existing_event' || comparison.status === 'updated_event')) {
      await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.ALREADY_EXISTING, undefined, sourceGroupId, sourceGroupName)
      return
    }
  }

  await handleNewEvent(eventId, rawMessage, cloudinaryUrl, cloudinaryData, event, originalMessage, client, messagePreview, sourceGroupId, sourceGroupName)
}

/**
 * Main event processing pipeline.
 * Single pipeline: Evidence Locator → parsers → Description Builder → Compare → Enrich → Save.
 */
export async function processEventPipeline(eventId, rawMessage, cloudinaryUrl, cloudinaryData, originalMessage, client) {
  const messageId = extractMessageId(rawMessage)
  let sourceGroupId = null
  let sourceGroupName = null

  try {
    logger.info(LOG_PREFIXES.EVENT_SERVICE, `Pipeline start for ${messageId}`)

    if (!validatePipelineInputs(eventId, rawMessage, cloudinaryUrl, cloudinaryData)) return

    const messageText = rawMessage.text || ''
    const messagePreview = messageText.substring(0, 20) || '(no text)'

    const remoteJid = originalMessage?.key?.remoteJid
    if (remoteJid && typeof remoteJid === 'string' && remoteJid.endsWith('@g.us')) {
      sourceGroupId = remoteJid
      if (client) {
        try {
          const meta = await client.groupMetadata(sourceGroupId)
          sourceGroupName = meta.subject || null
        } catch (_) { /* ignore */ }
      }
    }

    if (!messageText.trim()) {
      logger.info(LOG_PREFIXES.EVENT_SERVICE, `Skipping ${messageId} — no text`)
      await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.NO_TEXT, undefined, sourceGroupId, sourceGroupName)
      return
    }

    await processEventPipelineVerificationFirst(eventId, rawMessage, cloudinaryUrl, cloudinaryData, originalMessage, client, messageId, messagePreview, sourceGroupId, sourceGroupName)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(LOG_PREFIXES.EVENT_SERVICE, `Pipeline error for ${messageId}: ${errorMsg}`)
    const messagePreview = (rawMessage?.text || '').substring(0, 20) || '(error)'
    try { await cleanupAndDeleteEvent(eventId, cloudinaryData, messagePreview, CONFIRMATION_REASONS.PIPELINE_ERROR, undefined, sourceGroupId, sourceGroupName) } catch (_) { /* already logged */ }
  }
}

export { validateEventProgrammatic } from './eventValidation.js'
export { callOpenAIForClassification, callOpenAIForExtraction, callOpenAIForComparison } from './eventOpenAI.service.js'

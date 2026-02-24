import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES } from '../consts/index.js'
import { isImageUrl } from '../consts/events.const.js'
import { openai } from './openai.service.js'
import { incrementOpenAICalls, incrementGoogleVisionCalls } from './usageTracking.service.js'

const OCR_PREFIX = 'OCR'

const OPENAI_VISION_PROMPT = 'Extract all text from this image exactly as shown. Return only the raw text, no commentary.'

/**
 * Fetches image buffer from a URL (e.g. Cloudinary).
 * @param {string} imageUrl
 * @returns {Promise<Buffer|null>}
 */
async function fetchImageBuffer(imageUrl) {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} fetch image failed: ${msg}`)
    return null
  }
}

/**
 * Runs OCR via OpenAI Vision (image_url or base64). Returns extracted text or null.
 * @param {string} imageUrl - Public image URL (e.g. Cloudinary)
 * @param {Buffer} buffer - Image buffer (used when imageUrl not suitable or for data URL)
 * @returns {Promise<string|null>}
 */
async function runOcrOpenAiVision(imageUrl, buffer) {
  const content = [
    { type: 'text', text: OPENAI_VISION_PROMPT },
  ]
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } })
  } else if (buffer && buffer.length > 0) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
    })
  } else {
    return null
  }

  const model = config.ocr?.openAiVisionModel || config.openai?.model || 'gpt-4o'
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 2000,
    })
    await incrementOpenAICalls()
    const text = response.choices?.[0]?.message?.content?.trim() ?? ''
    return text || null
  } catch (error) {
    const errLog = {
      ...(error?.status != null && { status: error.status }),
      ...(error?.code != null && { code: error.code }),
      message: error instanceof Error ? error.message : String(error),
    }
    logger.error(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} OpenAI Vision error`, errLog)
    return null
  }
}

/**
 * Runs OCR via Google Cloud Vision when enabled and configured.
 * When Google Vision returns null and fallback is enabled, tries OpenAI Vision.
 * Returns null if OCR is disabled, image is not valid, or both providers fail (no throw).
 *
 * @param {string} imageUrl - Public image URL (e.g. Cloudinary) or unused when buffer provided
 * @param {Buffer|null} [imageBuffer] - Optional buffer (e.g. from media upload) to avoid re-fetch
 * @returns {Promise<{ fullText: string, blocks: Array<{id:string,text:string,confidence:number,bbox?:[number,number,number,number]}>, lines: Array<{id:string,text:string,confidence:number,blockId?:string}> }|null>}
 */
export async function runOcr(imageUrl, imageBuffer = null) {
  if (!config.ocr?.enabled) {
    return null
  }
  if (!imageUrl || !isImageUrl(imageUrl)) {
    return null
  }

  const provider = config.ocr?.provider || 'google_vision'
  if (provider !== 'google_vision') {
    return null
  }

  let buffer = imageBuffer
  if (!buffer && imageUrl) {
    buffer = await fetchImageBuffer(imageUrl)
  }
  if (!buffer || buffer.length === 0) {
    return null
  }

  let googleResult = null
  if (config.ocr?.googleCredentials) {
    try {
      const { ImageAnnotatorClient } = await import('@google-cloud/vision')
      const client = new ImageAnnotatorClient({ credentials: config.ocr.googleCredentials })

    const [result] = await client.documentTextDetection({
      image: { content: buffer.toString('base64') },
    })

    const fullText = result?.fullTextAnnotation?.text?.trim() ?? ''
    const blocks = []
    const lines = []

    const page = result?.fullTextAnnotation?.pages?.[0]
    if (!page) {
      googleResult = { fullText, blocks, lines }
    } else {
      let blockIndex = 0
      for (const block of page.blocks || []) {
        const blockId = `b${blockIndex}`
        const blockText = (block.paragraphs || [])
          .map((p) => (p.words || []).map((w) => (w.symbols || []).map((s) => s.text || '').join('')).join(''))
          .join('\n')
        const conf = block.confidence ?? 0
        const verts = block.boundingBox?.vertices || []
        const bbox = verts.length >= 4
          ? [
              verts[0].x ?? 0,
              verts[0].y ?? 0,
              (verts[2].x ?? 0) - (verts[0].x ?? 0),
              (verts[2].y ?? 0) - (verts[0].y ?? 0),
            ]
          : undefined
        blocks.push({ id: blockId, text: blockText, confidence: conf, bbox })
        let lineIndex = 0
        for (const paragraph of block.paragraphs || []) {
          const lineText = (paragraph.words || []).map((w) => (w.symbols || []).map((s) => s.text || '').join('')).join('')
          if (lineText) {
            const lineId = `l${blockIndex}_${lineIndex}`
            lines.push({
              id: lineId,
              text: lineText,
              confidence: paragraph.confidence ?? 0,
              blockId,
            })
            lineIndex++
          }
        }
        blockIndex++
      }
      googleResult = { fullText, blocks, lines }
    }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} Google Vision failed: ${msg}`)
    }
  }

  if (googleResult) {
    await incrementGoogleVisionCalls()
    logger.info(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} used Google Vision`)
    return googleResult
  }

  if (config.ocr?.fallbackOpenAiVision) {
    try {
      const fullText = await runOcrOpenAiVision(imageUrl, buffer)
      if (fullText) {
        logger.info(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} used OpenAI Vision fallback`)
        return { fullText, blocks: [], lines: [] }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const errLog = { message: msg, ...(err?.status != null && { status: err.status }), ...(err?.code != null && { code: err.code }) }
      logger.error(LOG_PREFIXES.EVENT_SERVICE, `${OCR_PREFIX} OpenAI Vision fallback failed`, errLog)
    }
  }

  return null
}

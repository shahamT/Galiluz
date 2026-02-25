import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import P from 'pino'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { LOG_PREFIXES, TIMEOUTS } from '../consts/index.js'
import { listAllGroups } from './group.service.js'

let sock = null
/** When true, connection close handler will not start reconnect (e.g. during graceful shutdown). */
let isShuttingDown = false

const baileysLogger = P({ level: 'silent' })

/**
 * Initializes and starts the Baileys WhatsApp socket.
 * @param {Object} [options] - Optional callbacks
 * @param {Function} [options.onIncomingMessage] - Async function(msg) called for each incoming message when connection is open
 * @returns {Promise<Object>} Baileys socket instance
 */
export async function initializeClient(options = {}) {
  if (sock) {
    logger.info(LOG_PREFIXES.WHATSAPP, 'Client already exists, returning existing instance')
    return sock
  }

  logger.info(LOG_PREFIXES.WHATSAPP, 'Creating new client instance...')
  logger.info(LOG_PREFIXES.WHATSAPP, `Auth path: ${config.authPath}`)

  const { state, saveCreds } = await useMultiFileAuthState(config.authPath)
  const { version } = await fetchLatestBaileysVersion()

  logger.info(LOG_PREFIXES.WHATSAPP, `Using WA Web version: ${version.join('.')}`)

  sock = makeWASocket({
    version,
    logger: baileysLogger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    generateHighQualityLinkPreview: false,
  })

  const onIncomingMessage = options?.onIncomingMessage

  return new Promise((resolve, reject) => {
    const initTimeout = setTimeout(() => {
      const timeoutSeconds = Math.floor(TIMEOUTS.CLIENT_INIT / 1000)
      reject(new Error(`Client initialization timeout after ${timeoutSeconds} seconds`))
    }, TIMEOUTS.CLIENT_INIT)

    sock.ev.process(async (events) => {
      if (events['connection.update']) {
        const { connection, lastDisconnect, qr } = events['connection.update']

        if (qr) {
          logger.info(LOG_PREFIXES.WHATSAPP, '\n=== WhatsApp QR Code (scan to authenticate) ===')
          logger.info(LOG_PREFIXES.WHATSAPP, 'Scan with WhatsApp mobile app. In production: use raw data below in an online QR generator if needed.')
          logger.info(LOG_PREFIXES.WHATSAPP, '')
          qrcode.generate(qr, { small: true })
          logger.info(LOG_PREFIXES.WHATSAPP, '')
          logger.info(LOG_PREFIXES.WHATSAPP, '=== Raw QR Data (paste into any online QR generator if you cannot scan from logs) ===')
          logger.info(LOG_PREFIXES.WHATSAPP, qr)
          logger.info(LOG_PREFIXES.WHATSAPP, '=== End Raw QR Data ===')
        }

        if (connection === 'open') {
          clearTimeout(initTimeout)
          logger.info(LOG_PREFIXES.WHATSAPP, 'Client is ready!')
          logger.info(LOG_PREFIXES.WHATSAPP, `Mode: ${config.discoveryMode ? 'DISCOVERY' : 'LOCKED'}`)

          if (config.discoveryMode) {
            logger.info(LOG_PREFIXES.WHATSAPP, 'Discovery mode active - listening to all groups')
            await listAllGroups(sock)
          } else {
            if (config.groupIds.length === 0) {
              logger.info(LOG_PREFIXES.WHATSAPP, 'Locked mode active - no groups configured')
            } else {
              logger.info(LOG_PREFIXES.WHATSAPP, `Locked mode active - listening to ${config.groupIds.length} group(s):`)
              config.groupIds.forEach((groupId, index) => {
                logger.info(LOG_PREFIXES.WHATSAPP, `  ${index + 1}. ${groupId}`)
              })
            }
          }

          resolve(sock)
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isShuttingDown

          logger.info(LOG_PREFIXES.WHATSAPP, `Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`)

          if (shouldReconnect) {
            clearTimeout(initTimeout)
            sock = null
            try {
              const newSock = await initializeClient(options)
              resolve(newSock)
            } catch (err) {
              reject(err)
            }
          } else {
            clearTimeout(initTimeout)
            logger.error(LOG_PREFIXES.WHATSAPP, 'Logged out. Delete auth folder and re-authenticate.')
            reject(new Error('WhatsApp logged out'))
          }
        }
      }

      if (events['creds.update']) {
        await saveCreds()
      }

      if (events['messages.upsert']) {
        const { messages: upsertMessages, type } = events['messages.upsert']

        if (type !== 'notify') return

        if (onIncomingMessage) {
          for (const msg of upsertMessages) {
            try {
              await onIncomingMessage(msg)
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              logger.error(LOG_PREFIXES.WHATSAPP, `Error processing message: ${errorMsg}`)
            }
          }
        }
      }
    })
  })
}

/**
 * Gets the current socket instance.
 * @returns {Object|null}
 */
export function getClient() {
  return sock
}

/**
 * Destroys the socket connection.
 * Sets isShuttingDown so the connection-close handler does not start a reconnect.
 */
export async function destroyClient() {
  isShuttingDown = true
  if (sock) {
    try {
      sock.end(undefined)
    } catch (_) { /* ignore */ }
    sock = null
  }
}

/**
 * Downloads media from a Baileys message.
 * @param {Object} msg - Baileys message object
 * @returns {Promise<{data: string, mimetype: string}|null>} Base64 data + mimetype
 */
export async function downloadMedia(msg) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer) return null

    const contentType = getContentType(msg.message)
    const mediaMsg = msg.message?.[contentType]
    const mimetype = mediaMsg?.mimetype || 'application/octet-stream'

    return {
      data: buffer.toString('base64'),
      mimetype,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(LOG_PREFIXES.WHATSAPP, `Error downloading media: ${errorMsg}`)
    return null
  }
}

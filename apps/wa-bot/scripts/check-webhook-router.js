/**
 * Dev script: verify webhook router extracts phone_number_id and shouldForwardToDev logic.
 * Run from apps/wa-bot: node scripts/check-webhook-router.js
 */
import { getPhoneNumberId, shouldForwardToDev } from '../src/utils/whatsappWebhookRouter.js'

const TEST_PHONE_NUMBER_ID = '1028248877037153'

const fixture = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123',
      changes: [
        {
          field: 'messages',
          value: {
            metadata: {
              phone_number_id: TEST_PHONE_NUMBER_ID,
              display_phone_number: '15551699470',
            },
            messages: [{ from: '972501234567', type: 'text', text: { body: 'hi' } }],
          },
        },
      ],
    },
  ],
}

const configForwardEnabled = {
  whatsappDevForwardEnabled: true,
  whatsappTestPhoneNumberId: TEST_PHONE_NUMBER_ID,
  whatsappDevForwardUrl: 'https://abc.ngrok-free.app',
  whatsappDevForwardPath: '/webhook',
}

const configForwardDisabled = {
  ...configForwardEnabled,
  whatsappDevForwardEnabled: false,
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log('  OK:', message)
  } else {
    failed++
    console.error('  FAIL:', message)
  }
}

console.log('check-webhook-router')
console.log('')

const extracted = getPhoneNumberId(fixture)
assert(extracted === TEST_PHONE_NUMBER_ID, `getPhoneNumberId(fixture) === "${TEST_PHONE_NUMBER_ID}"`)

assert(getPhoneNumberId({}) === null, 'getPhoneNumberId({}) === null')
assert(getPhoneNumberId({ entry: [] }) === null, 'getPhoneNumberId({ entry: [] }) === null')

assert(
  shouldForwardToDev(configForwardEnabled, TEST_PHONE_NUMBER_ID, undefined) === true,
  'shouldForwardToDev(..., testId, undefined) === true'
)
assert(
  shouldForwardToDev(configForwardEnabled, TEST_PHONE_NUMBER_ID, '1') === false,
  'shouldForwardToDev(..., testId, "1") === false (no loop)'
)
assert(
  shouldForwardToDev(configForwardDisabled, TEST_PHONE_NUMBER_ID, undefined) === false,
  'shouldForwardToDev(forwardDisabled, ...) === false'
)
assert(
  shouldForwardToDev(
    { ...configForwardEnabled, whatsappDevForwardUrl: '' },
    TEST_PHONE_NUMBER_ID,
    undefined
  ) === false,
  'shouldForwardToDev(empty forward URL, ...) === false'
)
assert(
  shouldForwardToDev(configForwardEnabled, 'other-id', undefined) === false,
  'shouldForwardToDev(..., other phone_number_id, ...) === false'
)

console.log('')
if (failed > 0) {
  console.error(`Result: ${passed} passed, ${failed} failed`)
  process.exit(1)
}
console.log(`Result: ${passed} passed`)

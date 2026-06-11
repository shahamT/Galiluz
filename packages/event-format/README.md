# @galiluz/event-format

Shared package that owns the **publisher-formatted event contract** and the OpenAI-backed helpers that produce it. Private, ESM (`"type": "module"`), entry point [index.js](index.js).

The authoritative field-by-field contract is [FORMATTED_EVENT_CONTRACT.md](FORMATTED_EVENT_CONTRACT.md). For how the formatted event is stored in MongoDB (the `event` field of an events document), see [docs/DATA_MODEL.md](../../docs/DATA_MODEL.md).

## Who consumes it

- **apps/wa-bot** — the only `package.json` consumer, via a file dependency (`"event-format": "file:../../packages/event-format"`). Used in the bot's event add/edit flows ([eventAddFlow.js](../../apps/wa-bot/src/flows/eventAddFlow.js), [eventsCreate.service.js](../../apps/wa-bot/src/services/eventsCreate.service.js)). On Render the repo must be cloned in full so the file dependency resolves — see [docs/WA_BOT_SETUP.md](../../docs/WA_BOT_SETUP.md).
- **Web app server** — does not import the package, but [server/utils/eventValidation.ts](../../server/utils/eventValidation.ts) (`validatePublisherFormattedEvent`) validates the same shape when wa-bot POSTs events. **The contract and that validator must stay in sync** — change both together.
- **apps/wa-listener** does NOT use this package; it has its own extraction pipeline (see [docs/EVENT_OBJECT_INTEGRATION.md](../../docs/EVENT_OBJECT_INTEGRATION.md)) that produces the same stored shape.

## Exports

| Export | Purpose |
|--------|---------|
| `formatPublisherEvent(raw, categoriesList, opts)` | Main entry: raw publisher form data → `{ formattedEvent, flags }` or `{ formattedEvent: null, errorReason }` |
| `generateShortDescription(title, fullDescription, opts)` | Regenerate shortDescription after a description edit |
| `parseOccurrencesFromText` / `parsePriceFromText` / `parseUrlsFromText` | Free-text field parsers for the bot edit flow |
| `normalizeCityForEdit` / `normalizeCityToListedOrCustom` / `verifyCityInNorthernIsrael` | City normalization and region check |
| `detectEventFromFreeText` / `extractEventFromFreeText` | Free-language event detection/extraction |
| `extractEventTextFromPage` / `selectEventRelevantImageUrls` | Web-page text extraction and image selection |
| `normalizeFormattedEventOccurrences`, `extractNavLinksFromRaw`, `convertMessageToHtml`, `htmlToWhatsAppMessage`, `parseFreeLanguageEditRequest` | Shape/format utilities (no OpenAI call) |

## Behavior notes

- All AI helpers call OpenAI with strict JSON-schema responses; key from `options.openaiApiKey` or `OPENAI_API_KEY`, model from `options.openaiModel` or `OPENAI_MODEL` (default `gpt-4o-mini`).
- `formatPublisherEvent` retries retryable OpenAI errors (429/408/5xx) up to 3 attempts and does only a minimal shape check — the Nuxt server is the real validator on write.
- Occurrence times are produced as Israel-local and normalized to ISO; AI-invented end times are dropped unless the raw text clearly states one.
- `flags` mark fields the AI could not parse (allowed keys are whitelisted in [schema.js](schema.js)); the bot uses them to ask the publisher follow-up questions.

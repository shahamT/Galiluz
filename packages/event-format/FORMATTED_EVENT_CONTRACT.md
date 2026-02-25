# Formatted event contract

This document defines the **publisher-formatted event** shape produced by `formatPublisherEvent()` in this package and validated by the Nuxt server (`server/utils/eventValidation.ts`). Both sides must stay in sync.

## Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `Title` | string | yes | Non-empty; fallback "אירוע" if raw empty. |
| `shortDescription` | string | yes | From AI; Hebrew by default. Must be derived only from event name (Title) and full description; must not include price, location, occurrences, or other fields. |
| `fullDescription` | string | yes | HTML (e.g. WhatsApp formatting converted). |
| `mainCategory` | string | yes | One of the valid category ids; must be in `categories`. |
| `categories` | string[] | yes | At least one; all must be valid category ids. |
| `location` | object | yes | See below. |
| `occurrences` | object[] | yes | At least one; see below. |
| `price` | number \| null | yes | Finite number or null. |
| `media` | array | yes | From raw (e.g. Cloudinary URLs). |
| `urls` | array | yes | `{ Title, Url, type: "link" \| "phone" }[]`. |
| `publisherPhone` | string \| undefined | no | From raw publisher. |
| `publisherName` | string \| undefined | no | From raw publisher. |
| `publisherId` | string \| undefined | no | Set by server (create/process) from publishers collection \_id. |

## location

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `City` | string | yes | Normalized city name. |
| `locationName` | string \| undefined | no | Venue/place name. |
| `addressLine1` | string \| null | no | |
| `addressLine2` | string \| null | no | |
| `locationDetails` | string \| null | no | |
| `wazeNavLink` | string \| null | no | Extracted from raw nav links. |
| `gmapsNavLink` | string \| null | no | Extracted from raw nav links. |

## occurrences[]

Each element:

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `date` | string | yes | `YYYY-MM-DD` (Israel date). |
| `hasTime` | boolean | yes | true if specific time given. |
| `startTime` | string | yes | ISO 8601 date-time (UTC); seconds required. |
| `endTime` | string \| null | yes | ISO 8601 or null; if present must be after startTime. |

**ISO date-time:** Server validation expects pattern: `YYYY-MM-DDTHH:mm:ss` with optional fractional seconds and `Z` or timezone offset (e.g. `2025-02-24T12:00:00.000Z`).

## Categories

- Valid category ids come from Nuxt `GET /api/categories` (or server `getCategoriesList()`).
- If AI returns no valid category, fallback is `community_meetup`.
- `mainCategory` must be one of the values in `categories`.

## Who uses this contract

- **packages/event-format** — Builds this shape after OpenAI response; `isValidAIResult()` does minimal shape check.
- **server/utils/eventValidation.ts** — `normalizePublisherFormattedEvent()` and `validatePublisherFormattedEvent()` enforce the full contract before persist.
- **apps/wa-bot** — Sends the result of `formatPublisherEvent()` to Nuxt; Nuxt validates before updating draft or creating event.

When changing the schema (e.g. new field or rule), update this doc, the event-format build logic, and server validation together.

## Flags (wa-bot only)

`formatPublisherEvent()` may return an optional `flags` array: `{ fieldKey: string, reason: string }[]`. These indicate raw fields the AI could not reliably parse. Flags are consumed only by wa-bot to re-ask the user for those fields; they are not sent to Nuxt or persisted.

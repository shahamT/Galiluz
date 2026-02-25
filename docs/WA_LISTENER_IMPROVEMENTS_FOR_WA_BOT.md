# Improvements for wa-bot / server event formatting (from wa-listener)

Comparison of **wa-listener** (event extraction from free-form WhatsApp + OCR) with **wa-bot + server** (publisher form → OpenAI format). Recommendations to align behavior, consistency, and correctness.

---

## 1. Date/time context: dynamic Israel offset

**wa-listener** ([apps/wa-listener/src/consts/events.const.js](apps/wa-listener/src/consts/events.const.js)): `getDateTimeContext()` returns:
- `CURRENT_DATE`, `CURRENT_TIME` (Israel local)
- `DAY_OF_WEEK` (Hebrew)
- **`TIMEZONE: Asia/Jerusalem (UTC+2)` or `(UTC+3)`** — computed at runtime from `Intl` so the model always sees the **current** offset.

**wa-bot** ([packages/event-format/](packages/event-format/)): Formatting runs in wa-bot via the shared `event-format` package. Date context is provided by `getCurrentIsraelUtcOffset()` in `israelDate.js` (current Israel UTC offset at runtime).

**Improvement:** Add the **current** Israel UTC offset to the context (e.g. compute via `Date` + `toLocaleString` in Asia/Jerusalem and derive offset), and inject it into the prompt (e.g. "Current Israel offset: UTC+2. Use this for converting times in dateTimeRaw to UTC."). Reduces model mistakes when DST boundary is near.

---

## 2. Explicit UTC conversion examples in the prompt

**wa-listener** ([apps/wa-listener/src/services/eventOpenAI.service.js](apps/wa-listener/src/services/eventOpenAI.service.js)) extraction prompt includes:
- "All times in messages are in Israel local time (UTC+2 or UTC+3). You MUST convert them to UTC..."
- **Concrete examples:** "message '20:00' Israel, offset UTC+2 → startTime '…T18:00:00.000Z'. Message '17:30' Israel, offset UTC+2 → startTime '…T15:30:00.000Z'."
- "Interpret Hebrew like '8 בערב' as 20:00 Israel local, then convert that to UTC for startTime."

**wa-bot:** Formatting is in [packages/event-format/](packages/event-format/). Prompt describes the rule and Hebrew afternoon mapping; add 1–2 numeric conversion examples there if desired.

**Improvement:** Add 1–2 short examples to the publisher-format system prompt, e.g.: "Example: dateTimeRaw '5 במרץ 10:00–15:00' Israel, March 5 2026 (UTC+2) → startTime 08:00Z, endTime 13:00Z."

---

## 3. Programmatic occurrence normalization (optional)

**wa-listener** ([apps/wa-listener/src/services/eventValidation.js](apps/wa-listener/src/services/eventValidation.js)): `validateEventProgrammatic()`:
- Ensures `occ.date` and the date implied by `occ.startTime` in Israel match; if not, **rebuilds** `startTime` via `localTimeIsraelToUtcIso(occ.date, timeStr)`.
- For all-day events: forces `startTime = israelMidnightToUtcIso(occ.date)` and `endTime = null`.
- Uses [apps/wa-listener/src/utils/israelTime.js](apps/wa-listener/src/utils/israelTime.js) for DST-aware Israel ↔ UTC.

**wa-bot:** [packages/event-format/](packages/event-format/) does not post-process AI occurrences; only schema/structural validation. Server ([server/utils/eventValidation.ts](server/utils/eventValidation.ts)) validates the formatted event.

**Improvement:** After receiving AI occurrences, run an optional normalization step: for each occurrence, if `occ.date` and the Israel date of `occ.startTime` differ, recompute `startTime` (and if present `endTime`) from `occ.date` + time-in-Israel using a shared Israel-time util (e.g. port `localTimeIsraelToUtcIso` / `israelMidnightToUtcIso` to server or a shared package). This corrects off-by-one or wrong-offset cases without changing the rest of the flow.

---

## 4. Price parsing rules and free phrases

**wa-listener** ([apps/wa-listener/src/parsers/priceParser.js](apps/wa-listener/src/parsers/priceParser.js)): Explicit list of **free-indicating phrases** (חינם, בחינם, free, כניסה חופשית, etc.); rejects ambiguous multi-tier (e.g. "X / Y" or "X–Y ₪"); parses numeric price with currency (₪, שקל, ש"ח, nis).

**wa-listener extraction prompt:** "0 if free is explicitly stated. null if no price... Ignore a price only when it is clearly the price of items sold at the event (e.g. costumes, food, merchandise)."

**wa-bot:** Prompt in event-format package says "Free / 'חינם' / 0 → 0. If unclear or not a single number, use null." Free phrases live in [server/consts/publisherEventConsts.ts](server/consts/publisherEventConsts.ts) (used by wa-listener); event-format has its own prompt text.

**Improvement:** Reuse or mirror the free-phrase list and "ignore when clearly not event price" rule in the publisher-format prompt so price handling is consistent (e.g. same Hebrew/English free phrases, same null when ambiguous or multi-tier).

---

## 5. Location schema and evidence (optional for wa-bot)

**wa-listener** schema ([apps/wa-listener/src/consts/openaiSchemas.const.js](apps/wa-listener/src/consts/openaiSchemas.const.js)): `location` has **CityEvidence** (verbatim snippet). Validation clears city/location when there is no justification.

**wa-bot:** No evidence field; publisher data is trusted. No change required unless you want traceability (e.g. store raw city string for debugging).

**Improvement (low priority):** If you ever need to log "what the user entered vs what we normalized", consider storing a single raw location/nav string (you already have `navLinks`). No schema change needed for now.

---

## 6. Categories: fallback and validation

**wa-listener** ([apps/wa-listener/src/services/eventValidation.js](apps/wa-listener/src/services/eventValidation.js)): If no valid category from extraction, sets `community_meetup`; ensures `mainCategory` is in `categories` and corrects if not.

**wa-bot:** [server/utils/eventValidation.ts](server/utils/eventValidation.ts) checks `mainCategory` is in `categories` and applies fallback `community_meetup` when needed ([server/consts/publisherEventConsts.ts](server/consts/publisherEventConsts.ts)).

**Improvement:** If validation finds `categories` empty or invalid, set a fallback (e.g. `community_meetup`) and set `mainCategory` to that, then re-validate — same pattern as wa-listener so both pipelines never persist events with empty categories.

---

## 7. Date range and multi-day parsing

**wa-listener** ([apps/wa-listener/src/parsers/dateTimeParser.js](apps/wa-listener/src/parsers/dateTimeParser.js)): **Deterministic** parsing of date ranges: "18-23.2", "18.2-1.3", "18 עד 21 בפברואר" → expand to explicit list of YYYY-MM-DD; `buildOccurrences()` returns one occurrence per date with same time applied to each day.

**wa-bot:** dateTimeRaw is parsed only by the model in [packages/event-format/](packages/event-format/). No deterministic parser.

**Improvement:** For consistency and to avoid model drift, consider adding a **deterministic date/time parser** for the publisher flow (e.g. port or share `dateTimeParser` + `israelTime`): run it on `dateTimeRaw`; if it returns at least one occurrence, use it and skip or only supplement AI occurrences. This would make multi-day and time ranges consistent with wa-listener and reduce reliance on the model for arithmetic.

---

## 8. Sanitization and prompt safety

**wa-listener** ([apps/wa-listener/src/services/eventOpenAI.service.js](apps/wa-listener/src/services/eventOpenAI.service.js)): `sanitizeMessageForPrompt()` — truncates length, strips leading instruction-override patterns (e.g. "ignore previous instructions", "you are now...").

**wa-bot:** [packages/event-format/](packages/event-format/) sanitizes raw event fields (truncation, override-pattern strip) in `promptSanitize.js` before building the user message.

**Improvement:** Before building the user content for OpenAI, run a lightweight sanitizer on string fields (e.g. `dateTimeRaw`, `title`, `description`): truncate to a safe length and optionally strip leading lines that match override patterns. Reduces prompt-injection and token-burst risk.

---

## 9. endTime validation

**wa-listener** ([apps/wa-listener/src/services/eventValidation.js](apps/wa-listener/src/services/eventValidation.js)): Validates `startTime`/`endTime` are valid dates; can clear invalid `endTime`; checks `startTime` not more than 2 years in future.

**wa-bot server:** [server/utils/eventValidation.ts](server/utils/eventValidation.ts): Validates `startTime` is ISO date-time; **does not validate `endTime`** format or end > start.

**Improvement:** In `validatePublisherFormattedEvent` (or a separate normalization step), ensure each `endTime` (if present) is a valid ISO date-time and is after `startTime`; otherwise set to null. Optionally flag or reject if `startTime` is unreasonably far in the future (e.g. > 2 years).

---

## 10. Shared Israel-time utilities

**wa-listener:** [apps/wa-listener/src/utils/israelTime.js](apps/wa-listener/src/utils/israelTime.js) — `israelMidnightToUtcIso`, `localTimeIsraelToUtcIso`, `getDateInIsraelFromIso`, `israelDateFromUnix`. Used by dateTimeParser and eventValidation.

**wa-bot server:** [server/utils/](server/utils/) has no Israel-time helpers; [server/utils/eventsTransform.ts](server/utils/eventsTransform.ts) uses `getDateInIsraelFromIso` from `~/utils/israelDate` (Nuxt app util). [packages/event-format/israelDate.js](packages/event-format/israelDate.js) provides `getCurrentIsraelUtcOffset()` for the format prompt.

**Improvement:** Centralize Israel-time helpers (e.g. in a shared package or server utils) so both wa-listener and server use the same DST-aware logic for occurrence build and normalization. Reduces duplication and keeps behavior identical.

---

## Summary table

| # | Area | wa-listener | wa-bot/server | Improvement |
|---|------|-------------|---------------|-------------|
| 1 | Date context | Current offset (UTC+2/3) in prompt | Fixed rule text | Add current offset to context |
| 2 | UTC examples | Explicit examples in prompt | Rule only | Add 1–2 conversion examples |
| 3 | Occurrence normalization | Rebuild startTime/endTime from date+time Israel | None | Optional post-step with Israel-time util |
| 4 | Price | Free phrases + “ignore non-event price” | Short rule | Align free phrases and null rules |
| 5 | Location evidence | CityEvidence, justifications | Trusted input | Optional raw trace only |
| 6 | Categories | Fallback community_meetup, fix mainCategory | Validation only | Add fallback + fix before persist |
| 7 | Date range | Deterministic parser + buildOccurrences | AI only | Consider shared parser for dateTimeRaw |
| 8 | Prompt safety | Sanitize length + override patterns | event-format sanitizes in promptSanitize.js | Aligned |
| 9 | endTime | Validate/correct invalid or end ≤ start | Not validated | Validate endTime; null if invalid |
| 10 | Israel time | israelTime.js | Only getDateInIsraelFromIso (app) | Shared Israel-time utils for server + listener |

Implementing 1, 2, 4, 6, and 9 improves consistency and robustness. 3, 7, and 10 are larger but give the most benefit for date/time correctness. (Prompt safety #8 is already handled in event-format.)

/**
 * Shared occurrence extraction rules for Hebrew date/time parsing.
 * Used by formatPublisherEvent, parseOccurrencesFromText, and extractEventFromFreeText.
 */
export const OCCURRENCE_RULES = `OCCURRENCES (rawOccurrences → occurrences array):

ORDINAL vs WEEKDAY (critical — Hebrew uses same words for both):
- "X ב[month]" (ordinal + month, NO "עד") = DAY OF MONTH. Example: "חמישי באפריל" = April 5th, "הרביעי באפריל" = April 4th.
  Ordinal mapping: ראשון=1, שני=2, שלישי=3, רביעי=4, חמישי=5, שישי=6, שביעי=7.
- "X עד Y ב[month]" (ordinal עד ordinal + month) = WEEKDAY RANGE. Example: "חמישי עד השישי ביוני" = Thursday to Friday in June → find those weekdays in that month.
- "N-N ב[month]" (digit-digit) = DATE RANGE. Example: "5-6 ביוני" = June 5 and June 6 (two occurrences).
- Ordinal WITHOUT month (e.g. "ביום רביעי") = weekday.

HEBREW TIME MAPPINGS:
- אחת=1:00, שתיים/שתים=14:00, שתים עשרה/משתים עשרה=12:00, שלוש=15:00, ארבע=16:00, חמש=17:00, שש=18:00, שבע=19:00, שמונה=20:00, תשע=21:00, עשר=22:00.
- "בשעה שלוש" = 15:00, "בשעה ארבע" = 16:00, "בשעה שש" = 18:00, "בשעה שבע" = 19:00.
- "בשעה N" (digit 1–12, no AM/PM) = afternoon: 7 → 19:00, 8 → 20:00, etc.
- "בערב" with שש/שבע/שמונה/תשע/עשר = 18:00–22:00.
- "עד N" (until N) = end time: "עד 7" = until 19:00.

NUMERIC DATE FORMATS:
- "N.M HH:mm" or "d.m 12:00" = day N of month M at time. Example: "5.6 12:00" = June 5 at 12:00. Use year from context.
- "N.M" without time = day N of month M, all-day (hasTime: false).

OUTPUT: date=YYYY-MM-DD, hasTime=true if time given else false. startTime and endTime: output as YYYY-MM-DDTHH:mm (Israel local time, NO Z suffix) — we convert to UTC. Example: 15:00 Israel on April 5 → "2026-04-05T15:00". Do NOT add Z or timezone. endTime=null when no end time.

NO HALLUCINATION: No date → flag rawOccurrences. No start time → hasTime: false, startTime = date at 00:00 Israel (YYYY-MM-DDT00:00). No end time → endTime: null (do NOT invent). endTime only when explicit ("עד 7", "עד 12", "18:00-21:00", "ל3 שעות").`

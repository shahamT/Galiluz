import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { extractEventFromFreeText } from '@galiluz/event-format'
// @ts-expect-error — plain JS consts, no types
import { getCategoriesList } from '~/consts/events.const.js'
// @ts-expect-error — plain JS consts, no types
import { CITIES as CITIES_MAP } from '~/consts/regions.const.js'

/**
 * Event-NAME quality eval (npm run eval:title) — calls the REAL OpenAI, skipped without a key.
 *
 * Unlike a deterministic unit test, title quality is an LLM judgement, so each case asserts
 * machine-checkable properties of the produced title (no hype tagline / no date-time context / a
 * content keyword present) and we push the PASS RATE up by tuning the rawTitle prompt rule + the
 * deterministic cleanTitle. Cases are real WhatsApp messages from the dev DB + invented edge cases.
 */

const apiKey = (process.env.OPENAI_API_KEY || '').trim()
const model = (process.env.OPENAI_MODEL_WEB || process.env.OPENAI_MODEL || 'gpt-4o').trim()
const reportPath = process.env.EVAL_REPORT || resolve(process.cwd(), 'tests/eval/.last-title-run.txt')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const categoriesList = getCategoriesList()
const citiesList = Object.entries(CITIES_MAP).map(([id, c]) => ({ id, title: (c as { title: string }).title, region: (c as { region: string }).region }))

interface TitleCase {
  name: string
  message: string
  requireOneOf?: string[] // title must contain at least one (case-insensitive)
  forbid?: string[] // title must contain none of these
  maxWords?: number
}

const cases: TitleCase[] = [
  // ── real DB messages (hype/CTA opening line, or trailing context) ──────────────
  {
    name: 'wine tasting — opening line is a CTA',
    message: '🍷הערב ביער מרפא דפנה! בואו לטעום יינות מצוינים ולשמוע את הגישה המיוחדת שעומדת מאחוריהם. הגישה הביודינאמית שבתה את ליבם של יובל וגדי כבר קרוב ל-20 שנה. נתראה ב-19:00.',
    requireOneOf: ['יין', 'טעימ'],
    forbid: ['בואו', 'הערב', '19:00'],
    maxWords: 7,
  },
  {
    name: 'independence day party — hype first line "וואלה התגעגענו"',
    message: 'וואלה התגעגענו! אנשי הצפון יודעים לחגוג 🎉 ואנחנו כפסע מלהפוך למדינה ה-52 בארה״ב 😜 אז מזמינים אתכם לחגוג איתנו את יום העצמאות ה-250 של ארצות הברית! מוצ״ש 4.7 בשעה 20:00.',
    requireOneOf: ['עצמאות', 'מסיב'],
    forbid: ['התגעגענו', 'וואלה', '4.7'],
    maxWords: 8,
  },
  {
    name: 'bass party — date/time first line + slogan',
    message: '25.6 || 22:00 מביאים את בשורת הבייס לצפון✨ מה אתם עושים הערב?? מסיבת טראנס ובייס שתעיף אתכם, מגוון ופונה לכל העולמות. כרטיסים ב-70 ש״ח בקישור.',
    requireOneOf: ['בייס', 'טראנס', 'מסיב'],
    forbid: ['25.6', '22:00', 'מה אתם עושים'],
    maxWords: 6,
  },
  {
    name: 'career networking — opening line is a question',
    message: '*סטודנטים וצעירים בגליל ובגולן?* בואו ל־Career Boost – ערב נטוורקינג, הרצאה של אברי אסולין, בירות, פיצות ותקלוט של אלעזר ה-DJ. יום רביעי 2.7 ב-19:00.',
    requireOneOf: ['נטוורקינג', 'career', 'קריירה'],
    forbid: ['סטודנטים וצעירים בגליל', '19:00'],
    maxWords: 7,
  },
  {
    name: 'foraging workshop — hype "הטבע המטורף" opening',
    message: '🌿 יוצאים לגלות את הטבע המטורף שיש לנו ממש מתחת לאף 🌿 יחידת הצעירים מזמינה אתכם לסדנת ליקוט עם לילך מוצפי! בואו ללמוד לזהות צמחי בר אכילים. יום חמישי 25.6.',
    requireOneOf: ['ליקוט', 'סדנ'],
    forbid: ['מטורף', 'יוצאים לגלות', '25.6'],
    maxWords: 7,
  },
  {
    name: 'wine festival — trailing "בסופש הקרוב" context',
    message: 'פסטיבל היין של ראש פינה בסופש הקרוב! עשרות יקבים, דוכני אוכל והופעות חיות לאורך כל הסופ״ש בכיכר המייסדים.',
    requireOneOf: ['פסטיבל', 'יין'],
    forbid: ['בסופש', 'הקרוב'],
    maxWords: 7,
  },
  // ── invented edge cases ────────────────────────────────────────────────────────
  {
    name: 'pure hype tagline + real content',
    message: 'האירוע המטורף של השנה!! 🔥 מסיבת ריקודים ענקית עם DJ קוסמי על הדק, יום שישי הקרוב מ-22:00 במועדון בקצרין.',
    requireOneOf: ['ריקוד', 'מסיב', 'dj'],
    forbid: ['המטורף של השנה', 'האירוע המטורף', '22:00'],
    maxWords: 7,
  },
  {
    name: 'clear explicit name — keep it',
    message: 'הופעה של שלמה ארצי בהיכל התרבות! יום שלישי 14.7 בשעה 20:00, כרטיסים אחרונים בקישור.',
    requireOneOf: ['ארצי'],
    forbid: ['20:00', 'כרטיסים', '14.7'],
    maxWords: 7,
  },
  {
    name: 'lecture — "אל תפספסו" CTA + subject',
    message: 'אל תפספסו! הרצאה מרתקת על גידול דבורים וייצור דבש עם ד״ר כהן, מחר ב-19:00 בבית התרבות.',
    requireOneOf: ['דבור', 'הרצא', 'דבש'],
    forbid: ['אל תפספסו', 'מחר', '19:00'],
    maxWords: 7,
  },
  {
    name: 'yoga workshop — trailing "ראשון הקרוב"',
    message: 'סדנת יוגה לנשים בהנחיית מאיה, יום ראשון הקרוב בבוקר במרכז הקהילתי. מתאים לכל הרמות.',
    requireOneOf: ['יוגה', 'סדנ'],
    forbid: ['הקרוב', 'ראשון הקרוב'],
    maxWords: 7,
  },
  {
    name: 'kids show — emoji + day + time',
    message: '🎪 הצגת ילדים: "מי פחד מהזאב הרע" בתיאטרון העירוני, השבת ב-11:00. כרטיסים בקופה.',
    requireOneOf: ['ילד', 'הצג', 'זאב'],
    forbid: ['השבת', '11:00'],
    maxWords: 8,
  },
  {
    name: 'standup — trailing date/time',
    message: 'ערב סטנדאפ עם הקומיקאי יוסי בפאב השכונה, מוצ״ש 28.6 בשעה 21:00.',
    requireOneOf: ['סטנדאפ', 'קומ'],
    forbid: ['21:00', '28.6', 'מוצ'],
    maxWords: 7,
  },
]

const EMOJI_RE = /[\p{Extended_Pictographic}]/u

function checkTitle(title: string, c: TitleCase): string[] {
  const reasons: string[] = []
  const t = (title || '').trim()
  if (!t) return ['empty']
  if (t === 'אירוע') reasons.push('fallback title "אירוע"')
  if (EMOJI_RE.test(t)) reasons.push('contains emoji')
  const low = t.toLowerCase()
  for (const f of c.forbid || []) if (low.includes(f.toLowerCase())) reasons.push(`contains forbidden "${f}"`)
  if (c.requireOneOf && !c.requireOneOf.some((r) => low.includes(r.toLowerCase()))) reasons.push(`missing all of [${c.requireOneOf.join(', ')}]`)
  if (c.maxWords && t.split(/\s+/).filter(Boolean).length > c.maxWords) reasons.push(`> ${c.maxWords} words`)
  return reasons
}

async function extractWithRetry(message: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await extractEventFromFreeText(message, categoriesList, citiesList, { openaiApiKey: apiKey, openaiModel: model })
    if (res?.formattedEvent) return res
    if (!res?.transient) return res // deterministic failure — don't retry
    await sleep(3000 * attempt)
  }
  return extractEventFromFreeText(message, categoriesList, citiesList, { openaiApiKey: apiKey, openaiModel: model })
}

describe.skipIf(!apiKey)('event title quality eval', () => {
  it('produces a real event name (no hype tagline / no date-time context)', async () => {
    const out: string[] = [`model: ${model}   cases: ${cases.length}`, '']
    const misses: string[] = []
    let pass = 0

    for (const c of cases) {
      await sleep(400)
      const res = await extractWithRetry(c.message)
      const title = res?.formattedEvent?.Title ?? ''
      const reasons = res?.formattedEvent ? checkTitle(title, c) : ['extraction failed: ' + (res?.errorReason || 'n/a')]
      const ok = reasons.length === 0
      if (ok) pass++
      out.push(`${ok ? '✓' : '✗'}  "${title}"   ⟸  ${c.name}`)
      if (!ok) misses.push(`[${c.name}] title="${title}" :: ${reasons.join('; ')}`)
    }

    const rate = pass / cases.length
    out.push('', '── overall ──', `pass: ${pass}/${cases.length} = ${(rate * 100).toFixed(0)}%`)
    if (misses.length) out.push('', `MISSES (${misses.length}):`, ...misses.map((m) => '  ' + m))
    const report = out.join('\n')
    console.log('\n' + report + '\n')
    try { writeFileSync(reportPath, report) } catch { /* best-effort */ }

    // Title quality is LLM-driven — push the prompt/cleaner until this passes with margin.
    expect(rate).toBeGreaterThanOrEqual(0.9)
  })
})

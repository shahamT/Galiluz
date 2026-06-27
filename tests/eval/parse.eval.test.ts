import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { extractEventFromFreeText } from '@galiluz/event-format'
// @ts-expect-error — plain JS consts, no types
import { getCategoriesList } from '~/consts/events.const.js'
// @ts-expect-error — plain JS consts, no types
import { CITIES as CITIES_MAP } from '~/consts/regions.const.js'

/**
 * Parse-quality eval (npm run eval:parse) — REAL OpenAI, skipped without a key. Guards the audit
 * fixes: appealing descriptions (lists used, no raw links), accurate location (no false
 * "outside-north"), and meaningful link titles. Cases are real DB messages + invented controls.
 */

const apiKey = (process.env.OPENAI_API_KEY || '').trim()
const model = (process.env.OPENAI_MODEL_WEB || process.env.OPENAI_MODEL || 'gpt-4o').trim()
const reportPath = process.env.EVAL_REPORT || resolve(process.cwd(), 'tests/eval/.last-parse-run.txt')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const categoriesList = getCategoriesList()
const citiesList = Object.entries(CITIES_MAP).map(([id, c]) => ({ id, title: (c as { title: string }).title, region: (c as { region: string }).region }))

interface ParseCase {
  name: string
  message: string
  expectList?: boolean // fullDescription should use <ul><li>
  outsideNorth?: 'must' | 'mustNot' // whether rawCityOutsideNorth SHOULD fire
  requireCats?: string[] // categories must include all of these
  expectEmoji?: boolean // fullDescription should carry at least one emoji (#3)
}

const cases: ParseCase[] = [
  {
    name: 'bass party — has a URL + says "לצפון" (northern, not outside)',
    message: '25.6 || 22:00 מביאים את בשורת הבייס לצפון✨ מסיבת טראנס ובייס שתעיף אתכם. כרטיסים ב-70 כאן!!! https://web.vibez.io/events/bassbusa3',
    outsideNorth: 'mustNot',
    expectEmoji: true,
  },
  {
    name: 'US-themed party held in the north (theme is not a location)',
    message: 'וואלה התגעגענו! אנשי הצפון יודעים לחגוג 🎉 מזמינים אתכם למסיבת יום העצמאות ה-250 של ארה״ב. שבת 4.7 משעה 14:00, כניסה חופשית!',
    outsideNorth: 'mustNot',
  },
  {
    name: 'גאווה גלילית — region adjective, not outside-north',
    message: 'מרכזי הצעירים חוגגים גאווה גלילית! אירוע של קהילה וחגיגה. מוצ"ש 27.6.26 פתיחת דלתות 19:30, 30 ש"ח לכרטיס. לינק לכרטיסים: https://mvhr.smarticket.co.il/x',
    outsideNorth: 'mustNot',
  },
  {
    name: 'winery party — many offerings → bullet list, no URL leak',
    message: '*מסיבה ביקב הר אודם! 🥂* 19.6 שישי 10:00-16:00. בתכנית: דיגי בסיל, דוכנים של יוצרי הגולן, קרמיקה אפרת, מוצרי בטון בעבודת יד, תכשיטים, ואוכל דרוזי של סיאם. הכניסה חופשית.',
    expectList: true,
    expectEmoji: true,
    outsideNorth: 'mustNot',
  },
  {
    name: 'no-emoji source → emojis added tastefully; link-reference phrase dropped',
    message: 'ערב הרצאות וסדנאות יצירה במתנ"ס מעלות. הרצאה על אמנות מודרנית, סדנת ציור וסדנת קרמיקה. רביעי 9.7 בשעה 18:00. מספר המקומות מוגבל, כרטיסים בלינק למטה. https://example.com/tickets',
    expectEmoji: true,
  },
  {
    name: 'foraging workshop — two URLs + a phone in the body',
    message: '🌿 סדנת ליקוט עם לילך מוצפי! בואו ללמוד לזהות צמחי בר אכילים. יום חמישי 25.6. מיקום: https://maps.app.goo.gl/MQ8 רכישה: https://greenbook.co.il/bs2/8021 לשאלות: יהונתן 0509493878',
    outsideNorth: 'mustNot',
  },
  {
    name: 'live concert → show + music',
    message: 'הופעה חיה של להקת האוטוביוגרפיה בפאב הקרומביין בנאות מרדכי, מוצ״ש 28.6 בשעה 21:00. כרטיסים בקופה.',
    requireCats: ['show', 'music'],
    outsideNorth: 'mustNot',
  },
  {
    name: 'CONTROL — genuinely southern city SHOULD be flagged outside-north',
    message: 'מסיבת ריקודים ענקית במועדון ההאנגר בתל אביב, שישי 4.7 מ-23:00. כרטיסים בקישור.',
    outsideNorth: 'must',
  },
]

const URL_RE = /(?:https?:\/\/|www\.)/i
const EMOJI_RE = /\p{Extended_Pictographic}/u
// Phrases that only point at a link/registration without adding info (#4) — should be removed.
const LINK_REF_RE = /בלינק|בקישור|בתגובות/
const BAD_TITLES = new Set(['כאן', 'לינק', 'here', 'click'])
// A title is "generic" if it's empty, a known filler word, or only punctuation/symbols.
// NOTE: don't use \W — Hebrew letters are non-\w in JS, so \W would flag every Hebrew title.
const isGenericTitle = (t: string): boolean => {
  if (!t) return true
  const core = t.replace(/[\s\p{P}\p{S}]+$/u, '').toLowerCase() // drop trailing !!! etc
  if (BAD_TITLES.has(core)) return true
  return /^[\s\p{P}\p{S}]+$/u.test(t) // only punctuation/symbols
}

function checkParse(res: any, c: ParseCase): string[] {
  const reasons: string[] = []
  const e = res?.formattedEvent
  if (!e) return ['extraction failed: ' + (res?.errorReason || 'n/a')]
  const desc = String(e.fullDescription || '')

  if (URL_RE.test(desc)) reasons.push('raw URL left in description')
  if (LINK_REF_RE.test(desc)) reasons.push('valueless link-reference phrase left in description (#4)')
  if (c.expectList && !/<li>/i.test(desc)) reasons.push('expected a <ul><li> list, got none')
  if (c.expectEmoji && !EMOJI_RE.test(desc)) reasons.push('expected at least one emoji, got none (#3)')

  const flaggedOutside = Array.isArray(res.flags) && res.flags.some((f: any) => f?.fieldKey === 'rawCityOutsideNorth')
  if (c.outsideNorth === 'mustNot' && flaggedOutside) reasons.push('falsely flagged rawCityOutsideNorth (dropped a northern city)')
  if (c.outsideNorth === 'must' && !flaggedOutside) reasons.push('should have flagged rawCityOutsideNorth (southern city)')

  for (const u of e.urls || []) {
    const t = String(u?.Title || '').trim()
    if (isGenericTitle(t)) reasons.push(`generic link title "${t}"`)
  }
  if (c.requireCats) {
    const cats = Array.isArray(e.categories) ? e.categories : []
    for (const want of c.requireCats) if (!cats.includes(want)) reasons.push(`categories missing "${want}" (got ${cats.join(',')})`)
  }
  return reasons
}

async function extractWithRetry(message: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await extractEventFromFreeText(message, categoriesList, citiesList, { openaiApiKey: apiKey, openaiModel: model })
    if (res?.formattedEvent || !res?.transient) return res
    await sleep(4000 * attempt)
  }
  return extractEventFromFreeText(message, categoriesList, citiesList, { openaiApiKey: apiKey, openaiModel: model })
}

describe.skipIf(!apiKey)('event parse quality eval', () => {
  it('descriptions are scannable & link-free, location is accurate, link titles are meaningful', async () => {
    const out: string[] = [`model: ${model}   cases: ${cases.length}`, '']
    const misses: string[] = []
    let pass = 0

    for (const c of cases) {
      await sleep(800)
      const res = await extractWithRetry(c.message)
      const reasons = checkParse(res, c)
      const ok = reasons.length === 0
      if (ok) pass++
      const title = res?.formattedEvent?.Title ?? '(none)'
      out.push(`${ok ? '✓' : '✗'}  ${c.name}  →  "${title}"`)
      if (!ok) {
        misses.push(`[${c.name}] ${reasons.join('; ')}`)
        out.push(`     desc: ${String(res?.formattedEvent?.fullDescription || '').slice(0, 200)}`)
      }
    }

    const rate = pass / cases.length
    out.push('', '── overall ──', `pass: ${pass}/${cases.length} = ${(rate * 100).toFixed(0)}%`)
    if (misses.length) out.push('', `MISSES (${misses.length}):`, ...misses.map((m) => '  ' + m))
    const report = out.join('\n')
    console.log('\n' + report + '\n')
    try { writeFileSync(reportPath, report) } catch { /* best-effort */ }

    expect(rate).toBeGreaterThanOrEqual(0.9)
  })
})

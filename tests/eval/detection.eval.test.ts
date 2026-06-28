import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { detectEventFromFreeText } from '@galiluz/event-format'

/**
 * Crawler detection edge-case eval (npm run eval:detection) — REAL OpenAI, skipped without a key.
 *
 * The crawler gate `detectEventFromFreeText` must KEEP real single events (even instances of a
 * recurring activity that have a specific date) while filtering two edge cases: (a) one message
 * bundling MULTIPLE distinct events (a season/program/schedule) and (b) an ongoing/recurring class
 * or multi-session course with no single dated occurrence.
 *
 * Asymmetric priority: KEEP-recall is the HARD gate (never drop a real event); REJECT-rate is the
 * soft goal (filtering edge cases is good, but a miss is acceptable). Fixtures are REAL prod raw
 * messages (cloned to dev) + a few invented controls.
 */
const apiKey = (process.env.OPENAI_API_KEY || '').trim()
const model = (process.env.OPENAI_MODEL_WEB || process.env.OPENAI_MODEL || 'gpt-4o').trim()
const reportPath = process.env.EVAL_REPORT || resolve(process.cwd(), 'tests/eval/.last-detection-run.txt')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Case { name: string; text: string }

// ── KEEP: real single events (must detect isEvent:true). ⭐ = recurring activity but a specific
// dated occurrence — the key guardrail the hardening must not break.
const KEEP: Case[] = [
  { name: '⭐ אקסטאטיק ראש פינה (recurring dance, dated 25.6)', text: `*💃אקסטאטיק ראש פינה🕺*\n*חמישי | 25.6 | 19:45-23:00*\nדי ג'יי - *Baraku*\nהנחתה - *אלאור*\n\nחמישי הקרוב רוקדים אקסטאטיק בראש פינה (כרגיל, בסטודיו שמאחורי המתנ"ס).\nאנא הרשמו עד ליום חמישי בשעה 11:00 בבוקר.\n*מחיר הרשמה מראש - 65 ש"ח*` },
  { name: 'מסיבת יום העצמאות (שבת 04.07)', text: `וואלה התגעגענו!\n\nמזמינים אתכן ואתכם להרים איתנו במסיבת יום העצמאות ה-250 של ארה״ב.\n- ליינאפ של דיג׳ייז מקומיים\n- עמדת נקניקיות\n- אלכוהול שווה\n\n_שבת, 04.07, החל משעה 14:00 _ *כניסה חופשית!*\nנגה ו-THE PEACH` },
  { name: 'טעימת יין ביער מרפא דפנה (הערב 20:30)', text: `🍷*הערב ביער מרפא דפנה! בואו לטעום יינות מצוינים* ולשמוע את הגישה המיוחדת שעומדת מאחוריהם.\n\nהשיחה - *ללא תשלום*\nמסלול טעימות - 60 ש"ח לאדם\n\n*הערב ב-20:30* בעגלה שביער מרפא דפנה\n📍על כביש 99 מול קיבוץ דפנה` },
  { name: 'מסיבת בייס (25.6 22:00)', text: `25.6 || 22:00\nמביאים את בשורת הבייס לצפון✨\n\nמתחילים בבייס בועט שיעלה לזנון טראנס וחזרה לבייס של הגבוה\nכרטיסים ב70 כאן!!! https://web.vibez.io/events/bassbusa3` },
  { name: 'גאווה גלילית (מוצ"ש 27.6.26)', text: `מרכזי הצעירים חוגגים גאווה גלילית!\n\nהצטרפו אלינו לאירוע מיוחד של קהילה, גאווה וחגיגה.\nמוצ"ש 27.6.26 פתיחת דלתות 19:30\nעלות מסובסדת : 30 ש"ח לכרטיס` },
  { name: 'קבלת שבת בנחל (שישי 26.6 15:30)', text: `*שישי בצהריים*, רעש של מים זורמים וניגונים שמרחיבים את הלב.\n\nהזמנה פתוחה לקבלת שבת בנחל! נפגשים בפארק הזהב.\n🎸 מוזיקה: ניגונים ושירים על שפת הנחל\n\nיום שישי ה-26.6 | 15:30 מתחילים | פארק הזהב\n🎟️ *הכניסה חופשית!*` },
  { name: 'Career Boost נטוורקינג (רביעי 1.7 19:00)', text: `*סטודנטים וצעירים בגליל ובגולן?*\nבואו ל־Career Boost – ערב נטוורקינג, הרצאה של אברי אסולין, בירות ופיצות.\n\n📅 רביעי | 1.7 | 19:00\n📍 בית החאן\n🎟️ ללא עלות` },
  { name: 'La ZuZ (חמישי 16.7 21:00)', text: `✨ La ZuZ ✨\nDj's Yoav saban & Symbolico\nמסיבות עם מוזיקה משובחת שמעיפה ומרגשת\n\nבחמישי ה16.7 בפאב הקרומביין בנאות מרדכי!\nחמישי 16.7 מ21:00\nכרטיסים כאן👇🏼 https://web.vibez.io/events/x` },
  { name: 'עידן אלתרמן סטנדאפ (2.7)', text: `*עידן אלתרמן* במופע סטנדאפ חדש בו הוא מספר לראשונה על הגירושים אחרי 25 שנה, על דייטים בגיל 50.\n*2.7 בסינמטק ראשפינה*\n*כרטיסים*◀️ https://www.shlager.live/event-details/x` },
  { name: 'משה אשכנזי סטנדאפ (חמישי 9.7)', text: `אחרי שרקד עם כוכבים וכיכב במטומטמת - *משה אשכנזי* במסע קורע מצחוק.\n*חמישי, 9.7 | סלון בזלת בקיבוץ אורטל*\n🎟️ כרטיסים> www.shlager.live/event-details/x` },
  { name: 'אירוע פתיחה הטריבל מייקרס (one launch event)', text: `מנתקים את החדשות ומתחברים לסיחרור🌪️\nתדר חדש נולד בצפון הרחוק, ובאירוע הפתיחה יככבו *הטריבל מייקרס* ההרכב הגלילי בסט אלקטרוני מחשמל ו *DJ אודי בן כנען*.\nכרטיסים ראשונים כאן >> https://did.li/0SAmC` },
  { name: '⭐ Groovement (monthly groove night, this upcoming one)', text: `הגיע הזמן לעוד Groovement !!!!\nוהפעם אנחנו חוגגים שנה!\n\nעל העמדה: Tashik, Ori Chait\nאחרי האירוע הקרוב נצא לפגרת קיץ.\nכרטיסי מוקדמות עד חמישי בבוקר 40 שח בלבד! בכניסה 60 שח\nhttps://links.payboxapp.com/x` },
  { name: '⭐ יריד של הפילוסופ (monthly fair, dated 3.7)', text: `*כמדי חודש, נפגשים ביריד של הפילוסופ 🪐*\nקפה, דרינקים, מוזיקה, בגדים, יוצרים ומעצבים.\n*יום שישי | 3.7 | 9:00-15:00\n*כניסה חופשית*🍇` },
  { name: '⭐ ערב מונדיאל בפילוסופ (tonight, specific match)', text: `*הערב בפילוסופ* ⚽️🍺\nממשיכים עם הערבי מונדיאל הנדירים שלנו.\nפתוחים מהשעה *20:30*\nב-22:00 משדרים את המשחק: *דרום אפריקה נגד קנדה*\nמקרן ענק בפנים. *משפחת פילוסופ | קיבוץ הגושרים*` },
  { name: "⭐ ג'אם אקוסטי (weekly jam, this week רביעי)", text: `השבוע הג'אם יהיה *ברביעי* (ולא בשני) ✨🎶\n*21:00 מתחילים*\nג'אם אקוסטי 🪕\n22:30 ג'אם רגיל\n*בית הג'אם לזכר אור כהן*, ליד הסינמטק` },
  { name: 'ערב השקה של חאנע (חמישי 2.7 18:00)', text: `שמעתם? אנחנו פותחים את ה"החאנע"! ☕✨\nמזמינים אתכם לערב ההשקה של "חאנע" – מרחב חדש של מוזיקה, תרבות וקהילה.\n🎶 הופעה חיה\n📍 בית החאן, קריית שמונה\n🗓️ יום חמישי | 2.7 | פתיחת דלתות 18:00\nהכניסה חופשית` },
]

// ── REJECT: edge cases (must detect isEvent:false). First two are the user's named targets.
const REJECT: Case[] = [
  { name: 'TARGET (a) קייצת שלאגר 2026 — a whole season/program, not one event', text: `קייצת *שלאגר* 2026 יוצאת לדרך בחמישי הקרוב🍉\n(מס' המקומות מוגבל)\n\nכאן נרשמים◀️ www.shlager.live/tickets` },
  { name: 'TARGET (b) שיעורי היפהופ — recurring weekly class, no date', text: `מקומות אחרונים לשיעורים\nשלנו השבוע💃🏽\n\nשיעורי היפהופ פיוז׳ן לנשים✨\n*בואי לחזור להתאהב בך ובריקוד!*\nלהרשמה ופרטים כתבי לי בפרטי\n דניאל 053-2321302\nנתראה🥰` },
  { name: '(a) staff memo listing many separate events across a week', text: `צוות יקר, תודה ענקית על ההשקעה.\nהשבוע בקצרה:\n📌 28.6–2.7 | סדנת חיילים משוחררים\n⚽ 29.6 | הקרנת המונדיאל\n🚀 1.7 | מועדון הקריירה הגלילי\n⭐ 2.7 | יום שיא והשקת הקפה בבית החאן\nכל הצוות מתבקש להגיע ולעזור.` },
  { name: '(b) וולנס על הנחל — 4-session series/course', text: `🌿 וולנס על הנחל 🌿\nמזמינים אתכם לעצור לרגע, להתחבר ולקחת נשימה עמוקה.\nהסדנאות יאפשרו לנו טעימה מעולמות הגוף-נפש.\n✨ מה בתוכנית שלנו? ✨\n4 מפגשים\nסאונד הילינג || יוגה || סדנת נשימה ואמבטיית קרח || טאי צ'י\nלפרטים, תאריכים ושמירת מקום הצטרפו לקהילה בוואצפ.` },
  { name: '(b) סטודיו פתוח — 5-session art course', text: `*צעירי ק"ש מוזמנים ל\'סטודיו פתוח\'*- סדרת מפגשים אומנותיים בקבוצה קטנה.\nהמפגש הראשון 15.7 | 18:00 | בית החאן\nהמחיר כולל את כל חמשת המפגשים, לכרטיסים: https://did.li/x` },
  { name: '(a) invented — festival season, 3 separate dated shows', text: `פסטיבל הקיץ של הגליל 2026! 🎉\nמופע הפתיחה - דודו טסה, 1.7\nערב ג'אז - 8.7\nמופע נעילה - שלמה ארצי, 15.7\nכרטיסים לכל המופעים באתר.` },
  { name: '(b) invented — weekly pilates class, monthly fee', text: `שיעורי פילאטיס מתחילים!\nכל יום שני ורביעי בשעה 18:00 באולם הספורט.\nהצטרפו עכשיו - מנוי חודשי 200 ש"ח. לפרטים בפרטי.` },
]

// ── Invented KEEP controls for the carve-outs (multi-day festival = one event; one-time workshop).
KEEP.push(
  { name: 'CONTROL — multi-day festival (one continuous event)', text: `פסטיבל הג'אז של הגליל!\n3 ימים של מוזיקה: 10-12.7, בכיכר המייסדים.\nמופעים לאורך כל היום, כניסה חופשית.` },
  { name: 'CONTROL — one-time dated workshop', text: `סדנת קדרות חד-פעמית! 🏺\nיום שישי 18.7 בשעה 10:00 בסטודיו.\nהביאו ידיים יוצרות, חומרים עלינו. הרשמה מראש.` },
)

async function detectWithRetry(text: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await detectEventFromFreeText(text, { openaiApiKey: apiKey, openaiModel: model })
    if (!r?.transient) return r
    await sleep(3000 * attempt)
  }
  return detectEventFromFreeText(text, { openaiApiKey: apiKey, openaiModel: model })
}

describe.skipIf(!apiKey)('crawler detection edge-case eval', () => {
  it('keeps real events; filters multi-event + recurring-class', async () => {
    const out: string[] = [`model: ${model}`, '']
    const misses: string[] = []
    let keepPass = 0
    let rejectPass = 0

    out.push('── KEEP (real events → expect isEvent:true) ──')
    for (const c of KEEP) {
      await sleep(400)
      const r = await detectWithRetry(c.text)
      const ok = r?.isEvent === true
      if (ok) keepPass++
      else misses.push(`KEEP DROPPED: ${c.name} :: ${r?.reason || 'n/a'}`)
      out.push(`${ok ? '✓' : '✗ DROPPED'}  ${c.name}`)
    }
    out.push('', '── REJECT (edge cases → expect isEvent:false) ──')
    for (const c of REJECT) {
      await sleep(400)
      const r = await detectWithRetry(c.text)
      const ok = r?.isEvent === false
      if (ok) rejectPass++
      else misses.push(`REJECT LEAKED: ${c.name}`)
      out.push(`${ok ? '✓' : '✗ LEAKED'}  ${c.name}`)
    }

    const keepRecall = keepPass / KEEP.length
    const rejectRate = rejectPass / REJECT.length
    out.push('', '── overall ──',
      `KEEP-recall (real events kept): ${keepPass}/${KEEP.length} = ${(keepRecall * 100).toFixed(0)}%  [HARD gate]`,
      `REJECT-rate (edge cases filtered): ${rejectPass}/${REJECT.length} = ${(rejectRate * 100).toFixed(0)}%  [maximize]`)
    if (misses.length) out.push('', `ISSUES (${misses.length}):`, ...misses.map((m) => '  ' + m))
    const report = out.join('\n')
    console.log('\n' + report + '\n')
    try { writeFileSync(reportPath, report) } catch { /* best-effort */ }

    // HARD: never drop real events. SOFT: filter most edge cases (incl. both named targets).
    expect(keepRecall).toBeGreaterThanOrEqual(0.94)
    expect(rejectRate).toBeGreaterThanOrEqual(0.6)
  })
})

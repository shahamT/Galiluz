// Fixtures for the crawler same-event matcher eval (npm run eval:matcher).
// Hebrew event variations grounded in real published events from the dev DB.
//
// Each CASE is a NEW message (formattedEvent as extraction would yield + the raw text)
// run against the shared candidatePool. expectedMatchId = the pool id it SHOULD be judged
// the same as, or null if it's a genuinely new/different event.
//
// "No place/date in the text" variations omit location.city and occurrences[].date to
// mimic extraction from a message whose place/date live only in the image.

export interface CandidateFixture {
  id: string
  title: string
  city: string
  date: string // YYYY-MM-DD (earliest future occurrence), '' if unknown
  shortDescription: string
}

export interface CaseFixture {
  name: string
  expectedMatchId: string | null
  formattedEvent: {
    Title: string
    shortDescription: string
    location: { city?: string }
    occurrences: Array<{ date?: string }>
  }
  messageText: string
}

// The account's existing events the new message is compared against.
export const candidatePool: CandidateFixture[] = [
  { id: 'wine', title: 'יריד היין ה-13 של ראש פינה', city: 'ראש פינה', date: '2026-06-18', shortDescription: 'יריד היין השנתי של ראש פינה עם עשרות יקבים ומזקקות, הופעה חיה ודוכני אוכל.' },
  { id: 'acoustic', title: 'דנה עדיני ועופר קורן בהופעה אקוסטית', city: 'נאות מרדכי', date: '2026-06-25', shortDescription: 'הופעה אקוסטית אינטימית של דנה עדיני ועופר קורן בפאב הקרומביין.' },
  { id: 'lecture', title: 'הרצאה: הטיפול הזוגי ב-MDMA', city: 'הגושרים', date: '2026-06-07', shortDescription: 'הרצאה של ד"ר איתמר כהן על טיפול זוגי ב-MDMA בקפה פילוסופ.' },
  { id: 'acro', title: 'מפגש אקרו ותנועה', city: 'שאר ישוב', date: '2026-06-02', shortDescription: 'מפגש אקרו ותנועה פתוח לכולם במתחם מסע באיזי.' },
  // Distinct candidates that share an artist / lecturer / venue with a base event but are
  // a DIFFERENT happening (different date and/or topic) — for precision (no false merges).
  { id: 'acoustic-april', title: 'דנה עדיני ועופר קורן באטריום', city: 'להבות הבשן', date: '2026-04-09', shortDescription: 'ערב מוזיקה עם דנה עדיני ועופר קורן באטריום, להבות הבשן.' },
  { id: 'lecture-kink', title: 'הפסיכולוגיה של הקינק', city: 'הגושרים', date: '2026-03-01', shortDescription: 'הרצאה של ד"ר איתמר כהן על הקשר בין קינק לפסיכולוגיה ואינטימיות.' },
  { id: 'philosoph-gon', title: 'גון בן ארי בקפה פילוסופ', city: 'הגושרים', date: '2026-05-30', shortDescription: 'ערב מוזיקה חיה עם גון בן ארי בקפה פילוסופ.' },
]

const withDate = (d: string) => [{ date: d }]
const noDate: Array<{ date?: string }> = []

export const cases: CaseFixture[] = [
  // ── WINE (יריד היין) — all the same event as candidate 'wine' ──────────────────
  {
    name: 'wine / early teaser (no date in text)',
    expectedMatchId: 'wine',
    formattedEvent: { Title: 'יריד היין חוזר לראש פינה!', shortDescription: 'יריד היין השנתי חוזר עם יקבים, אוכל ומוזיקה.', location: { city: 'ראש פינה' }, occurrences: noDate },
    messageText: 'שמרו את התאריך 🍷 יריד היין האהוב חוזר לראש פינה גם השנה! עשרות יקבים, אוכל טוב והופעות. פרטים מלאים בקרוב.',
  },
  {
    name: 'wine / near-date detailed',
    expectedMatchId: 'wine',
    formattedEvent: { Title: 'יריד היין ה-13 של ראש פינה – יום חמישי!', shortDescription: 'עשרות יקבים ומזקקות, הופעה של להקת רוקוויל ודוכני אוכל.', location: { city: 'ראש פינה' }, occurrences: withDate('2026-06-18') },
    messageText: 'מחר זה קורה! יריד היין ה-13 של ראש פינה, יום חמישי 18.6 משעה 18:00. עשרות יקבים ומזקקות, הופעה חיה של רוקוויל ודוכני אוכל. כרטיסים בקישור.',
  },
  {
    name: 'wine / family-audience framing',
    expectedMatchId: 'wine',
    formattedEvent: { Title: 'יום כיף משפחתי ביריד היין של ראש פינה', shortDescription: 'פינת יצירה לילדים, דוכני אוכל ויקבים להורים.', location: { city: 'ראש פינה' }, occurrences: withDate('2026-06-18') },
    messageText: 'מגיעים עם כל המשפחה ליריד היין של ראש פינה! פינות יצירה ופעילות לילדים, ולהורים – טעימות מעשרות יקבים. 18.6.',
  },
  {
    name: 'wine / reworded title',
    expectedMatchId: 'wine',
    formattedEvent: { Title: 'פסטיבל היין הגדול של ראש פינה', shortDescription: 'חגיגת יין שנתית עם יקבים, מזקקות ומוזיקה חיה.', location: { city: 'ראש פינה' }, occurrences: withDate('2026-06-18') },
    messageText: 'פסטיבל היין הגדול של ראש פינה! עשרות יקבים ומזקקות, מוזיקה חיה ואוכל משובח. 18 ביוני.',
  },
  {
    name: 'wine / no place+date (in image)',
    expectedMatchId: 'wine',
    formattedEvent: { Title: 'יריד היין שכולם מחכים לו', shortDescription: 'עשרות יקבים, הופעה חיה ודוכני אוכל.', location: {}, occurrences: noDate },
    messageText: 'היריד שכולם מחכים לו חוזר! 🍷 עשרות יקבים ומזקקות, הופעה חיה ודוכני אוכל. כל הפרטים בתמונה 👇',
  },

  // ── ACOUSTIC (דנה עדיני ועופר קורן, 25.6 נאות מרדכי) — same as 'acoustic' ─────
  {
    name: 'acoustic / general teaser',
    expectedMatchId: 'acoustic',
    formattedEvent: { Title: 'דנה עדיני ועופר קורן מגיעים לנאות מרדכי', shortDescription: 'הופעה אקוסטית בפאב הקרומביין.', location: { city: 'נאות מרדכי' }, occurrences: noDate },
    messageText: 'בקרוב אצלנו: דנה עדיני ועופר קורן בהופעה אקוסטית בפאב הקרומביין, נאות מרדכי. תאריך מדויק בקרוב!',
  },
  {
    name: 'acoustic / near-date detailed',
    expectedMatchId: 'acoustic',
    formattedEvent: { Title: 'דנה עדיני ועופר קורן – הופעה אקוסטית, 25.6', shortDescription: 'ערב אקוסטי אינטימי עם מופע פתיחה של תהל לוי.', location: { city: 'נאות מרדכי' }, occurrences: withDate('2026-06-25') },
    messageText: 'יום רביעי 25.6 בפאב הקרומביין נאות מרדכי – דנה עדיני ועופר קורן בהופעה אקוסטית, עם מופע פתיחה של תהל לוי. 21:00. כרטיסים בקישור.',
  },
  {
    name: 'acoustic / reworded title',
    expectedMatchId: 'acoustic',
    formattedEvent: { Title: 'ערב אקוסטי עם דנה עדיני ועופר קורן', shortDescription: 'מוזיקה אקוסטית בפאב הקרומביין נאות מרדכי.', location: { city: 'נאות מרדכי' }, occurrences: withDate('2026-06-25') },
    messageText: 'ערב אקוסטי מיוחד עם דנה עדיני ועופר קורן, בפאב הקרומביין. 25.6.',
  },
  {
    name: 'acoustic / no place+date (in image)',
    expectedMatchId: 'acoustic',
    formattedEvent: { Title: 'הופעה אקוסטית של דנה עדיני ועופר קורן', shortDescription: 'ערב אקוסטי אינטימי.', location: {}, occurrences: noDate },
    messageText: 'מתרגשים לארח את דנה עדיני ועופר קורן בהופעה אקוסטית! 🎶 כל הפרטים – מקום ושעה – בתמונה.',
  },

  // ── LECTURE (MDMA, ד"ר איתמר כהן, 7.6 קפה פילוסופ) — same as 'lecture' ────────
  {
    name: 'lecture / general teaser',
    expectedMatchId: 'lecture',
    formattedEvent: { Title: 'ערב הרצאה על זוגיות ו-MDMA', shortDescription: 'ד"ר איתמר כהן על טיפול זוגי ב-MDMA.', location: { city: 'הגושרים' }, occurrences: noDate },
    messageText: 'בקרוב בקפה פילוסופ: ד"ר איתמר כהן בהרצאה על טיפול זוגי ב-MDMA. תאריך בקרוב.',
  },
  {
    name: 'lecture / reworded title + near date',
    expectedMatchId: 'lecture',
    formattedEvent: { Title: 'הטיפול הזוגי באמצעות MDMA – הרצאה', shortDescription: 'הרצאה מרתקת על זוגיות וטיפול ב-MDMA עם ד"ר איתמר כהן.', location: { city: 'הגושרים' }, occurrences: withDate('2026-06-07') },
    messageText: '7.6 בקפה פילוסופ – ד"ר איתמר כהן מרצה על הטיפול הזוגי בעזרת MDMA. הרצאה מרתקת על אינטימיות וזוגיות. כרטיסים בקישור.',
  },
  {
    name: 'lecture / no place+date (in image)',
    expectedMatchId: 'lecture',
    formattedEvent: { Title: 'הרצאה: זוגיות ו-MDMA', shortDescription: 'ד"ר איתמר כהן על טיפול זוגי ב-MDMA.', location: {}, occurrences: noDate },
    messageText: 'הרצאה מיוחדת של ד"ר איתמר כהן על הטיפול הזוגי ב-MDMA. מתי ואיפה – הכל בתמונה 👇',
  },

  // ── ACRO meetup (שאר ישוב, 2.6) — same as 'acro' ─────────────────────────────
  {
    name: 'acro / reworded title (real dup)',
    expectedMatchId: 'acro',
    formattedEvent: { Title: "ג'אם אקרו ותנועה", shortDescription: 'מפגש אקרו ותנועה בשאר ישוב.', location: { city: 'שאר ישוב' }, occurrences: withDate('2026-06-02') },
    messageText: "ג'אם אקרו ותנועה בשאר ישוב, מתחם מסע באיזי. 2.6, פתוח לכולם, ללא הדרכה.",
  },
  {
    name: 'acro / no place+date (in image)',
    expectedMatchId: 'acro',
    formattedEvent: { Title: 'מפגש אקרו ותנועה פתוח', shortDescription: 'אקרו ותנועה לכל הרמות.', location: {}, occurrences: noDate },
    messageText: 'מפגש אקרו ותנועה פתוח לכולם 🤸 בואו לזוז יחד! המקום והשעה בתמונה.',
  },

  // ── DISTINCT — must NOT merge into the wrong candidate ───────────────────────
  {
    name: 'distinct / Noam Rotem @ Philosoph (≠ Gon Ben Ari, same venue)',
    expectedMatchId: null,
    formattedEvent: { Title: 'נועם רותם בקפה פילוסופ', shortDescription: 'הופעה של נועם רותם בקפה פילוסופ.', location: { city: 'הגושרים' }, occurrences: withDate('2026-06-04') },
    messageText: 'נועם רותם מגיע לקפה פילוסופ! 4.6, מופע לייב. אל תפספסו.',
  },
  {
    name: 'distinct / Dana Edini APRIL show (→ acoustic-april, not June)',
    expectedMatchId: 'acoustic-april',
    formattedEvent: { Title: 'דנה עדיני ועופר קורן באטריום', shortDescription: 'ערב מוזיקה באטריום להבות הבשן.', location: { city: 'להבות הבשן' }, occurrences: withDate('2026-04-09') },
    messageText: '9.4 באטריום להבות הבשן – דנה עדיני ועופר קורן בערב של מוזיקה טובה ואווירה קסומה.',
  },
  {
    name: 'distinct / Kink lecture (→ lecture-kink, not MDMA)',
    expectedMatchId: 'lecture-kink',
    formattedEvent: { Title: 'הפסיכולוגיה של הקינק – הרצאה', shortDescription: 'ד"ר איתמר כהן על קינק ופסיכולוגיה.', location: { city: 'הגושרים' }, occurrences: withDate('2026-03-01') },
    messageText: 'הרצאה של ד"ר איתמר כהן: הפסיכולוגיה של הקינק – על הקשר בין קינק לאינטימיות. 1.3.',
  },
  {
    name: 'distinct / acro on a different date (repeat ⇒ different event)',
    expectedMatchId: null,
    formattedEvent: { Title: 'מפגש אקרו ותנועה', shortDescription: 'מפגש אקרו ותנועה בשאר ישוב.', location: { city: 'שאר ישוב' }, occurrences: withDate('2026-06-16') },
    messageText: 'מפגש אקרו ותנועה בשאר ישוב, מתחם מסע באיזי. 16.6, פתוח לכולם.',
  },
  {
    name: 'distinct / genuinely new event (botanic fair)',
    expectedMatchId: null,
    formattedEvent: { Title: 'יריד BOTANIC בכפר סאלד', shortDescription: 'יריד אמנות ועיצוב מקומי עם דוכנים ומוזיקה.', location: { city: 'כפר סאלד' }, occurrences: withDate('2026-06-05') },
    messageText: 'יריד BOTANIC במתחם SZOLD ART כפר סאלד 🌿 אמנות ועיצוב מקומי, דוכנים, מוזיקה ואווירה גלילית. 5.6.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — edge cases in a different style: emoji/CAPS/slang, Hebrew+English mix,
// drastically reworded titles, "last tickets" reminders, postponement, and the
// hardest precision case: SAME date + venue but a DIFFERENT act (date guard can't
// help → pure semantic discrimination).
// ─────────────────────────────────────────────────────────────────────────────

export const candidatePool2: CandidateFixture[] = [
  { id: 'standup', title: 'סטנדאפ עם נועם שוסטר', city: 'קצרין', date: '2026-07-10', shortDescription: 'ערב סטנדאפ עם נועם שוסטר בפאב המקומי.' },
  { id: 'yoga', title: 'סדנת יוגה ונשימה', city: 'כפר בלום', date: '2026-07-12', shortDescription: 'סדנת בוקר של יוגה ונשימה עם דנה.' },
  { id: 'puppets', title: 'תיאטרון בובות לילדים – הברווזון המכוער', city: 'מטולה', date: '2026-07-05', shortDescription: 'הצגת בובות לכל המשפחה.' },
  { id: 'jazz', title: "ערב ג'אז בגלריה", city: 'ראש פינה', date: '2026-07-18', shortDescription: "ערב ג'אז עם טריו מקומי בגלריה." },
  // Decoys: same date + venue as a base event but a DIFFERENT act/concept.
  { id: 'standup-shira', title: 'סטנדאפ עם שירה מרגלית', city: 'קצרין', date: '2026-07-10', shortDescription: 'ערב סטנדאפ עם שירה מרגלית בפאב המקומי.' },
  { id: 'rock', title: 'ערב רוק בגלריה', city: 'ראש פינה', date: '2026-07-18', shortDescription: 'ערב רוק עם להקה מקומית בגלריה.' },
]

export const cases2: CaseFixture[] = [
  // ── standup (נועם שוסטר, 10.7) — same as 'standup' across wild styles ────────
  {
    name: 'edge:standup / emoji + CAPS, no date',
    expectedMatchId: 'standup',
    formattedEvent: { Title: 'סטנדאפ עם נועם שוסטר 🎤🔥', shortDescription: 'ערב סטנדאפ פרוע עם נועם שוסטר.', location: { city: 'קצרין' }, occurrences: noDate },
    messageText: '🎤🔥 סטנדאפ!!! נועם שוסטר מגיע לפאב!! ערב של צחוקים בלי הפסקה 😂😂 כל הפרטים בתמונה 👇👇',
  },
  {
    name: 'edge:standup / terse slang, no date',
    expectedMatchId: 'standup',
    formattedEvent: { Title: 'נועם שוסטר בפאב', shortDescription: 'ערב סטנדאפ.', location: { city: 'קצרין' }, occurrences: noDate },
    messageText: 'מחר!! נועם שוסטר!! בפאב!! בואו 🍺',
  },
  {
    name: 'edge:standup / Hebrew+English mix',
    expectedMatchId: 'standup',
    formattedEvent: { Title: 'Stand-up night with נועם שוסטר', shortDescription: 'A wild stand-up night.', location: { city: 'קצרין' }, occurrences: withDate('2026-07-10') },
    messageText: "Stand-up night 🎤 w/ נועם שוסטר @ the local pub, קצרין. July 10. Don't miss it! Tickets in link.",
  },
  {
    name: 'edge:standup / "last tickets" reminder',
    expectedMatchId: 'standup',
    formattedEvent: { Title: 'כרטיסים אחרונים! נועם שוסטר', shortDescription: 'הכרטיסים האחרונים לערב הסטנדאפ עם נועם שוסטר.', location: { city: 'קצרין' }, occurrences: withDate('2026-07-10') },
    messageText: '⚠️ כרטיסים אחרונים! הערב הסטנדאפ של נועם שוסטר כמעט אזל. 10.7 בפאב קצרין. מהרו להזמין!',
  },
  {
    name: 'edge:standup / drastically reworded title',
    expectedMatchId: 'standup',
    formattedEvent: { Title: 'צוחקים עד הבוקר עם נועם שוסטר', shortDescription: 'ערב צחוקים עם נועם שוסטר בפאב.', location: { city: 'קצרין' }, occurrences: withDate('2026-07-10') },
    messageText: 'צוחקים עד הבוקר! נועם שוסטר בפאב קצרין, 10.7. ערב סטנדאפ שאסור לפספס.',
  },

  // ── yoga (12.7) — same as 'yoga' ─────────────────────────────────────────────
  {
    name: 'edge:yoga / emoji style',
    expectedMatchId: 'yoga',
    formattedEvent: { Title: 'יוגה ונשימה בבוקר 🧘‍♀️', shortDescription: 'סדנת יוגה ונשימה.', location: { city: 'כפר בלום' }, occurrences: withDate('2026-07-12') },
    messageText: '🧘‍♀️ בוקר של יוגה ונשימה עם דנה, כפר בלום. 12.7 בבוקר. בואו לנשום ✨',
  },
  {
    name: 'edge:yoga / no place+date (in image)',
    expectedMatchId: 'yoga',
    formattedEvent: { Title: 'סדנת יוגה ונשימה עם דנה', shortDescription: 'סדנת בוקר רגועה.', location: {}, occurrences: noDate },
    messageText: 'מזמינות לסדנת יוגה ונשימה עם דנה 🌿 פרטים מלאים בתמונה.',
  },

  // ── puppets (5.7) — same as 'puppets' ────────────────────────────────────────
  {
    name: 'edge:puppets / reworded',
    expectedMatchId: 'puppets',
    formattedEvent: { Title: 'הצגת ילדים: הברווזון המכוער', shortDescription: 'הצגת בובות לכל המשפחה במטולה.', location: { city: 'מטולה' }, occurrences: withDate('2026-07-05') },
    messageText: 'הצגת ילדים 🦆 "הברווזון המכוער" בתיאטרון בובות, מטולה. 5.7. כיף לכל המשפחה!',
  },

  // ── HARD precision: same date + venue, DIFFERENT act (date guard can't help) ──
  {
    name: 'edge:distinct / שירה מרגלית standup, SAME date+venue as נועם (→ standup-shira)',
    expectedMatchId: 'standup-shira',
    formattedEvent: { Title: 'סטנדאפ עם שירה מרגלית', shortDescription: 'ערב סטנדאפ עם שירה מרגלית בפאב.', location: { city: 'קצרין' }, occurrences: withDate('2026-07-10') },
    messageText: 'ערב סטנדאפ עם שירה מרגלית בפאב קצרין, 10.7. בואו לצחוק!',
  },
  {
    name: 'edge:distinct / rock night, SAME date+venue as jazz (→ rock, not jazz)',
    expectedMatchId: 'rock',
    formattedEvent: { Title: 'ערב רוק בגלריה', shortDescription: 'ערב רוק עם להקה מקומית בגלריה.', location: { city: 'ראש פינה' }, occurrences: withDate('2026-07-18') },
    messageText: 'ערב רוק בגלריה ראש פינה! להקה מקומית, 18.7. אנרגיה גבוהה 🎸',
  },

  // ── postponement: same show, NEW date ⇒ different event (date guard) ──────────
  {
    name: 'edge:distinct / standup POSTPONED to a new date (⇒ different)',
    expectedMatchId: null,
    formattedEvent: { Title: 'נדחה! נועם שוסטר – מועד חדש', shortDescription: 'ערב הסטנדאפ של נועם שוסטר נדחה למועד חדש.', location: { city: 'קצרין' }, occurrences: withDate('2026-07-24') },
    messageText: 'שימו לב! ערב הסטנדאפ של נועם שוסטר נדחה ל-24.7 בפאב קצרין. הכרטיסים בתוקף.',
  },

  // ── genuinely new ────────────────────────────────────────────────────────────
  {
    name: 'edge:distinct / genuinely new (food-truck festival)',
    expectedMatchId: null,
    formattedEvent: { Title: 'פסטיבל פוד-טראקים', shortDescription: 'פסטיבל אוכל רחוב עם פוד-טראקים ומוזיקה.', location: { city: 'קרית שמונה' }, occurrences: withDate('2026-07-15') },
    messageText: 'פסטיבל פוד-טראקים 🚚🍔 קרית שמונה, 15.7. עשרות עמדות אוכל, מוזיקה ובירה. בואו רעבים!',
  },
]

export interface Suite { name: string; candidatePool: CandidateFixture[]; cases: CaseFixture[] }

export const suites: Suite[] = [
  { name: 'base', candidatePool, cases },
  { name: 'edge', candidatePool: candidatePool2, cases: cases2 },
]

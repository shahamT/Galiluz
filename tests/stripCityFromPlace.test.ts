import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import { stripCityFromName, stripCityFromLocationFields } from '~/packages/event-format/stripCityFromPlace.js'

/**
 * Conservative policy: strip the city from the place name ONLY when it is clearly appended —
 * via a preposition (ב/כ/ל/מ/ש), a comma/hyphen, or a settlement qualifier (קיבוץ/מושב) — or when
 * the place equals the city exactly. A plain "<venue> <city>" with no such signal is left unchanged,
 * so proper names are never clipped. Cases below are REAL rows pulled from the prod-clone DB.
 */

describe('stripCityFromName — strips a detached city (real DB cases)', () => {
  const STRIP: Array<[city: string, place: string, expected: string | null]> = [
    // preposition ב attached to the city (the reported bug)
    ['הגושרים', 'פאב הפילוסוף בגושרים', 'פאב הפילוסוף'],
    // preposition ב on a settlement qualifier + city
    ['אורטל', 'סלון בזלת בקיבוץ אורטל', 'סלון בזלת'],
    // settlement qualifier (קיבוץ) before the city
    ['גונן', 'בית רזי קיבוץ גונן', 'בית רזי'],
    // hyphen separator before a multiword "קיבוץ דן" city
    ['קיבוץ דן', 'פאב הפטריה - קיבוץ דן', 'פאב הפטריה'],
    // hyphen-glued city
    ['צפת', 'מאפיית בלה-צפת', 'מאפיית בלה'],
    // place is only the settlement (qualifier + city) → nothing meaningful left
    ['שדה נחמיה', 'קיבוץ שדה נחמיה', null],
    // exact match → emptied
    ['מתחם צנובר', 'מתחם צנובר', null],
  ]
  it.each(STRIP)('city=%s place=%s → %s', (city, place, expected) => {
    expect(stripCityFromName(city, place)).toBe(expected)
  })
})

describe('stripCityFromName — leaves proper names / undelimited cases unchanged (real DB cases)', () => {
  const KEEP: Array<[city: string, place: string]> = [
    ['תל חי', 'אוניברסיטת תל חי'], // construct name — must NOT become "אוניברסיטת"
    ['אודם', 'יקב הר אודם'], // winery proper name — must NOT become "יקב הר"
    ['אודם', 'מרכז המבקרים של יקב הר אודם'],
    ['עמיעד', 'פאב עמיעד'],
    ['ראש פינה', 'מתנ"ס ראש פינה'],
    ['ראש פינה', 'גינה קהילתית ראש פינה'],
    ['קריית שמונה', 'בית החאן קריית שמונה'],
    ['קריית שמונה', 'כיכר ההסתדרות 4 קריית שמונה'],
    ['מטולה', 'רחוב הראשונים מטולה'],
    ['דלתון', 'מרכז המבקרים של יקב אדיר (א.ת. דלתון)'], // city inside parens (address annotation)
    ['דפנה', 'עגלה שביער מרפא דפנה'],
  ]
  it.each(KEEP)('city=%s place=%s → unchanged', (city, place) => {
    expect(stripCityFromName(city, place)).toBe(place)
  })
})

describe('stripCityFromName — Hebrew prefix / article handling', () => {
  it('matches the city without its definite article (גושרים vs הגושרים)', () => {
    expect(stripCityFromName('גושרים', 'פאב הפילוסוף בגושרים')).toBe('פאב הפילוסוף')
  })
  it('strips after a comma', () => {
    expect(stripCityFromName('הגושרים', 'פאב הפילוסוף, גושרים')).toBe('פאב הפילוסוף')
  })
  it('strips a detached city at the START (preposition)', () => {
    expect(stripCityFromName('הגושרים', 'בגושרים פאב הפילוסוף')).toBe('פאב הפילוסוף')
  })
  it('strips when the place carries a preposition (במגדל)', () => {
    expect(stripCityFromName('מגדל', 'פאב במגדל')).toBe('פאב')
  })
})

describe('stripCityFromName — never over-strips (safety / no-op)', () => {
  it('leaves a place that does not contain the city', () => {
    expect(stripCityFromName('הגושרים', 'קפה פילוסופ')).toBe('קפה פילוסופ')
  })
  it('does not match a lookalike word (city מגדל vs place הגדול)', () => {
    expect(stripCityFromName('מגדל', 'פאב הגדול')).toBe('פאב הגדול')
  })
  it('leaves a plain "<venue> <city>" with no delimiter (city is part of the name)', () => {
    expect(stripCityFromName('מגדל', 'פאב מגדל')).toBe('פאב מגדל')
  })
  it('returns null for empty/missing place', () => {
    expect(stripCityFromName('הגושרים', '')).toBe(null)
    expect(stripCityFromName('הגושרים', null)).toBe(null)
    expect(stripCityFromName('הגושרים', undefined)).toBe(null)
  })
  it('returns the place unchanged when city is empty or 1 char', () => {
    expect(stripCityFromName('', 'פאב הפילוסוף')).toBe('פאב הפילוסוף')
    expect(stripCityFromName('ב', 'פאב הפילוסוף')).toBe('פאב הפילוסוף')
  })
})

describe('stripCityFromLocationFields', () => {
  it('strips the city from locationName but leaves an address line without the city', () => {
    expect(stripCityFromLocationFields('גונן', 'בית רזי קיבוץ גונן', 'רחוב הראשונים 5')).toEqual({
      locationName: 'בית רזי',
      addressLine1: 'רחוב הראשונים 5',
    })
  })
  it('returns nulls for empty inputs', () => {
    expect(stripCityFromLocationFields('הגושרים', null, null)).toEqual({ locationName: null, addressLine1: null })
  })
})

import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS helper, no types
import { cleanTitle } from '~/packages/event-format/cleanTitle.js'

describe('cleanTitle — strips trailing date/time/"when" qualifiers', () => {
  const CASES: Array<[input: string, expected: string]> = [
    ['פסטיבל היין של ראש פינה בסופש הקרוב', 'פסטיבל היין של ראש פינה'],
    ['פסטיבל היין של ראש פינה השבוע', 'פסטיבל היין של ראש פינה'],
    ['הרצאה על יין 18.6', 'הרצאה על יין'],
    ['הרצאה על יין 18.6.26', 'הרצאה על יין'],
    ['מסיבת טבע 22:00', 'מסיבת טבע'],
    ['מסיבת טבע 18:00-23:00', 'מסיבת טבע'],
    ['מופע סטנדאפ מחר', 'מופע סטנדאפ'],
    ['ריקודים שישי הקרוב', 'ריקודים'],
    ['ריקודים הערב', 'ריקודים'],
  ]
  it.each(CASES)('%s → %s', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected)
  })
})

describe('cleanTitle — strips decoration (markdown / emoji / quotes / edge punctuation)', () => {
  const CASES: Array<[input: string, expected: string]> = [
    ['*מסיבה ביקב הר אודם*', 'מסיבה ביקב הר אודם'],
    ['מסיבה ביקב הר אודם! 🥂', 'מסיבה ביקב הר אודם'],
    ['💃אקסטאטיק ראש פינה🕺', 'אקסטאטיק ראש פינה'],
    ['"ערב נשים"', 'ערב נשים'],
    ['🌿 וולנס על הנחל 🌿', 'וולנס על הנחל'],
    ['מסיבת 🔥 בייס', 'מסיבת בייס'], // internal emoji removed too
  ]
  it.each(CASES)('%s → %s', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected)
  })
})

describe('cleanTitle — never harms a clean name (no over-stripping)', () => {
  const KEEP = [
    'קבלת שבת בנחל', // שבת is content, not a "when" qualifier (no trigger)
    'מסיבת יום העצמאות ה-250 של ארה״ב',
    'מסיבת שישי', // a lone trailing day word is NOT stripped
    'וולנס על הנחל',
    'סדנת ליקוט לצעירים',
    'Career Boost – ערב נטוורקינג', // internal en-dash is content
    'פסטיבל היין של ראש פינה', // already clean
  ]
  it.each(KEEP)('%s → unchanged', (title) => {
    expect(cleanTitle(title)).toBe(title)
  })
})

describe('cleanTitle — edge inputs', () => {
  it('returns empty string for empty/whitespace', () => {
    expect(cleanTitle('')).toBe('')
    expect(cleanTitle('   ')).toBe('')
    expect(cleanTitle(null)).toBe('')
    expect(cleanTitle(undefined)).toBe('')
  })
  it('collapses internal whitespace', () => {
    expect(cleanTitle('ערב    מוזיקה')).toBe('ערב מוזיקה')
  })
  it('falls back to the original when cleaning would empty it', () => {
    expect(cleanTitle('🥂🥂')).toBe('🥂🥂')
  })
})

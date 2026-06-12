export const SITE_NAME = 'גלילו"ז'

export const SITE_NAME_ALT = ['גלילוז', 'Galiluz']

export const SEO_KEYWORDS = [
  'גלילו"ז',
  'גלילוז',
  'Galiluz',
  'גלילו"ז אירועים בצפון',
  'אירועים בצפון',
  'אירועים בגליל',
  'אירועים בגולן',
  'אירועים בגליל העליון',
  'אירועים ברמת הגולן',
  'מסיבות בצפון',
  'מסיבות בגליל',
  'מסיבות בגולן',
  'מה עושים בצפון',
  'מה קורה בצפון',
  'מה לעשות בצפון',
  'מה לעשות בגליל',
  'מה לעשות בגולן',
  'מה לעשות בסופ"ש בצפון',
  'פעילויות בצפון',
  'פעילויות בגליל',
  'פעילויות בגולן',
  'יומן אירועים בצפון',
  'יומן אירועים בגליל',
  'לוח אירועים בצפון',
  'אירועים היום בצפון',
  'הופעות בצפון',
  'הופעות בגליל',
  'סדנאות בצפון',
  'סדנאות בגליל',
  'ירידים ופסטיבלים בצפון',
  'אירועים קהילתיים בצפון',
  'תרבות ופנאי בצפון',
]

export const SEO_KEYWORDS_STRING = [...new Set(SEO_KEYWORDS)].join(', ')

export const SEO_DEFAULT_DESCRIPTION =
  'גלילו"ז – יומן אירועים ופעילויות בגליל, בגולן ובצפון. גלו מה קורה היום — מסיבות, הופעות, סדנאות ומה לעשות בסופ"ש.'

export const SEO_DEFAULT_TITLE = 'גלילו"ז | אירועים ופעילויות בגליל, בגולן ובצפון'

export const SEO_PAGES = {
  default: {
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION,
  },
  dailyView: {
    title: 'אירועים היום בצפון | גלילו"ז',
    description:
      'גלו מה קורה היום בגליל, בגולן ובצפון — מסיבות, הופעות, סדנאות ופעילויות. יומן אירועים מעודכן של גלילו"ז.',
  },
  monthlyView: {
    title: 'יומן אירועים חודשי | גלילו"ז – אירועים בגליל ובגולן',
    description:
      'צפו בכל האירועים והפעילויות החודש בגליל, בגולן ובצפון. מה לעשות, מסיבות והופעות — במקום אחד.',
  },
  about: {
    title: 'אודות גלילו"ז | יומן אירועים בצפון',
    description:
      'גלילו"ז נבנה כדי לרכז את כל מה שקורה בצפון — אירועים, פעילויות ומסיבות בגליל ובגולן — במקום אחד.',
  },
  publishEvents: {
    title: 'פרסום אירועים בגליל ובגולן | גלילו"ז',
    description:
      'פרסמו אירועים, מסיבות ופעילויות בגליל, בגולן ובצפון. הצטרפו למפרסמים של גלילו"ז.',
  },
  terms: {
    title: 'תנאי שימוש | גלילו"ז',
    description: 'תנאי השימוש ומדיניות הפרטיות של גלילו"ז — יומן האירועים בגליל, בגולן ובצפון.',
  },
}

/**
 * @param {string} baseUrl
 * @returns {Array<Record<string, unknown>>}
 */
export function buildSiteJsonLd(baseUrl) {
  const url = baseUrl.replace(/\/$/, '')
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: SITE_NAME_ALT,
      url,
      description: SEO_DEFAULT_DESCRIPTION,
      inLanguage: 'he',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      alternateName: SITE_NAME_ALT,
      url,
      logo: `${url}/galiluz-thumbnail.png`,
      description: SEO_DEFAULT_DESCRIPTION,
      areaServed: {
        '@type': 'Place',
        name: 'גליל והגולן, ישראל',
      },
    },
  ]
}

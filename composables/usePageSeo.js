import { SEO_KEYWORDS_STRING, SITE_NAME, buildSiteJsonLd } from '~/consts/seo.const'

/**
 * Applies consistent SEO meta tags across public pages.
 *
 * @param {{
 *   title: import('vue').MaybeRefOrGetter<string>,
 *   description: import('vue').MaybeRefOrGetter<string>,
 *   keywords?: import('vue').MaybeRefOrGetter<string>,
 *   ogImage?: import('vue').MaybeRefOrGetter<string | undefined>,
 *   ogUrl?: import('vue').MaybeRefOrGetter<string | undefined>,
 * }} options
 */
export function usePageSeo({ title, description, keywords = SEO_KEYWORDS_STRING, ogImage, ogUrl }) {
  const requestUrl = useRequestURL()
  const defaultOgImage = new URL('/galiluz-thumbnail.png', requestUrl.origin).href
  const resolvedOgImage = computed(() => toValue(ogImage) || defaultOgImage)
  const resolvedOgUrl = computed(() => toValue(ogUrl) || requestUrl.href)

  useHead({ title })
  useSeoMeta({
    title,
    description,
    keywords,
    ogTitle: title,
    ogDescription: description,
    ogImage: resolvedOgImage,
    ogUrl: resolvedOgUrl,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogLocale: 'he_IL',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: resolvedOgImage,
  })
}

/**
 * Injects WebSite + Organization JSON-LD for the whole app.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} baseUrl
 */
export function useSiteJsonLd(baseUrl) {
  useHead({
    script: computed(() => [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(buildSiteJsonLd(toValue(baseUrl))),
      },
    ]),
  })
}

/**
 * Fetches event meta (title, shortDescription, imageUrl) for SEO when route has ?event=id.
 * Runs on server during SSR so crawlers receive correct og:image, og:title, og:description.
 *
 * @returns {{ data: Ref<{ title: string, shortDescription: string, imageUrl: string | null }>, pending: Ref<boolean> }}
 */
export function useEventMetaForSeo() {
  const route = useRoute()
  const eventParam = computed(() => route.query.event)
  const docId = computed(() => {
    const param = eventParam.value
    if (!param || typeof param !== 'string') return null
    const trimmed = String(param).trim()
    if (!trimmed) return null
    const parts = trimmed.split('-')
    return parts[0] || trimmed
  })

  const emptyMeta = { title: '', shortDescription: '', imageUrl: null }

  const { data, pending } = useAsyncData(
    () => `event-meta-${docId.value ?? 'none'}`,
    () => {
      const id = docId.value
      if (!id) return emptyMeta
      return $fetch(`/api/events/${id}/meta`).catch(() => emptyMeta)
    },
    {
      watch: [docId],
      server: true,
      lazy: false,
    }
  )

  return {
    data: computed(() => data.value),
    pending,
  }
}

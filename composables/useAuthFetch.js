// Single-flight guard: parallel requests failing with 401 must trigger exactly
// one logout + redirect, not race each other.
let handling401 = false

export function useAuthFetch(url, options = {}) {
  const authStore = useAuthStore()
  const router = useRouter()

  const { onResponseError: callerOnResponseError, ...restOptions } = options

  return useFetch(url, {
    server: false,
    ...restOptions,
    async onResponseError(ctx) {
      if (callerOnResponseError) await callerOnResponseError(ctx)
      if (ctx.response.status === 401 && !handling401) {
        handling401 = true
        try {
          authStore.logout()
          await router.push('/login')
        } finally {
          handling401 = false
        }
      }
    },
  })
}

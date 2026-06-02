export function useAuthFetch(url, options = {}) {
  const authStore = useAuthStore()
  const router = useRouter()

  const { onResponseError: callerOnResponseError, ...restOptions } = options

  return useFetch(url, {
    server: false,
    ...restOptions,
    async onResponseError(ctx) {
      if (callerOnResponseError) await callerOnResponseError(ctx)
      if (ctx.response.status === 401) {
        authStore.logout()
        await router.push('/login')
      }
    },
  })
}

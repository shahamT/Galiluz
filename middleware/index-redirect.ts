export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/' && to.path !== '/events') return
  const query = to.query.event
    ? { event: to.query.event }
    : { date: new Date().toISOString().slice(0, 10) }
  return navigateTo({ path: '/events/daily-view', query }, { replace: true })
})

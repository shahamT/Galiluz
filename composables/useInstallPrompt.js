export function useInstallPrompt() {
  const deferredPrompt = ref(null)
  const canInstall = ref(false)
  const isIOS = ref(false)
  const isInstalled = ref(false)

  onMounted(() => {
    isInstalled.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!window.navigator.standalone

    isIOS.value =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e
      canInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      canInstall.value = false
      deferredPrompt.value = null
    })
  })

  async function triggerInstall() {
    if (!deferredPrompt.value) return
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') canInstall.value = false
    deferredPrompt.value = null
  }

  return { canInstall, isIOS, isInstalled, triggerInstall }
}

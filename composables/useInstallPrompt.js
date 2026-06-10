const _deferredPrompt = ref(null)
const canInstall = ref(false)
const isIOS = ref(false)
const isInstalled = ref(false)
const installEnabled = ref(false)
const showInstructions = ref(false)
let _listenersAttached = false

const INSTALL_FLAG_KEY = 'galiluz-dev-install'

export function useInstallPrompt() {
  const route = useRoute()

  onMounted(() => {
    if (route.query.install === '1') {
      try { sessionStorage.setItem(INSTALL_FLAG_KEY, '1') } catch {}
    }
    try { installEnabled.value = sessionStorage.getItem(INSTALL_FLAG_KEY) === '1' } catch {}

    if (_listenersAttached) return
    _listenersAttached = true

    isInstalled.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!window.navigator.standalone

    isIOS.value =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      _deferredPrompt.value = e
      canInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      canInstall.value = false
      _deferredPrompt.value = null
    })
  })

  async function triggerInstall() {
    if (!_deferredPrompt.value) return
    _deferredPrompt.value.prompt()
    const { outcome } = await _deferredPrompt.value.userChoice
    if (outcome === 'accepted') canInstall.value = false
    _deferredPrompt.value = null
  }

  return { canInstall, isIOS, isInstalled, installEnabled, showInstructions, triggerInstall }
}

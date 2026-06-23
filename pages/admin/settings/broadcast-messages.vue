<template>
  <div class="BroadcastMessages">
    <!-- Mobile drill-in: back to the settings list -->
    <NuxtLink to="/admin/settings" class="BroadcastMessages-back">
      <UiIcon name="arrow_forward" size="sm" />
      חזרה להגדרות
    </NuxtLink>

    <header class="BroadcastMessages-header">
      <h1 class="BroadcastMessages-title">שליחת הודעות למפרסמים</h1>
      <p class="BroadcastMessages-desc">
        שליחת הודעת וואטסאפ (טקסט ותמונה) למפרסמים מאושרים — לעדכוני מערכת ומבצעים. ההודעות נשלחות בקצב מבוקר כדי לשמור על המספר.
      </p>
    </header>

    <section class="BroadcastMessages-card">
      <!-- To -->
      <div class="BroadcastMessages-field">
        <label class="BroadcastMessages-label">נמענים</label>
        <AdminBroadcastRecipients v-model="selectedIds" :publishers="approvedPublishers" />
        <span class="BroadcastMessages-fieldHint">מוצגים מפרסמים מאושרים בלבד.</span>
      </div>

      <!-- Image -->
      <div class="BroadcastMessages-field">
        <label class="BroadcastMessages-label">תמונה (אופציונלי)</label>
        <AdminBroadcastImageUpload v-model="imageUrl" />
      </div>

      <!-- Message -->
      <div class="BroadcastMessages-field">
        <label class="BroadcastMessages-label">הודעה</label>
        <AdminBroadcastEditor v-model="message" :max-length="maxLength" :sample="previewSample" />
      </div>

      <!-- Send -->
      <div class="BroadcastMessages-actions">
        <p v-if="error" class="BroadcastMessages-error">{{ error }}</p>
        <p v-if="result" class="BroadcastMessages-success">{{ result }}</p>
        <p v-if="sending" class="BroadcastMessages-progress">
          נשלחו <strong>{{ progress.sent }}</strong> · נכשלו <strong>{{ progress.failed }}</strong> · מתוך {{ progress.total }}
        </p>
        <button
          type="button"
          class="BroadcastMessages-send"
          :disabled="!canSend"
          @click="send"
        >
          <span v-if="sending" class="BroadcastMessages-spinner" aria-hidden="true" />
          <UiIcon v-else name="send" size="sm" class="BroadcastMessages-sendIcon" />
          <span>{{ sending ? 'שולח…' : sendLabel }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsBroadcast' })

const selectedIds = ref([])
const imageUrl = ref('')
const message = ref('')
const allPublishers = ref([])
const sending = ref(false)
const error = ref('')
const result = ref('')
const progress = ref({ sent: 0, failed: 0, total: 0 })

let pollTimer = null
const POLL_MS = 2000
const STALL_MS = 120000 // no progress change for this long → assume the run ended (gateway gone)

const approvedPublishers = computed(() => allPublishers.value.filter((p) => p.status === 'approved'))

// First selected recipient (source order) — drives the editor's personalized preview.
const previewSample = computed(() => {
  const first = approvedPublishers.value.find((p) => selectedIds.value.includes(p.id))
  return first ? { publisherName: first.name, accountName: first.accountName } : null
})

// With an image the message is the caption (WhatsApp limit ~1024) — cap tighter, leaving
// headroom for the personalization tags expanding to names. Text-only allows much more.
const maxLength = computed(() => (imageUrl.value ? 1000 : 4000))

const sendLabel = computed(() => `שליחה ל-${selectedIds.value.length} מפרסמים`)
const canSend = computed(
  () =>
    !sending.value &&
    selectedIds.value.length > 0 &&
    (message.value.trim().length > 0 || !!imageUrl.value) &&
    message.value.length <= maxLength.value,
)

async function loadPublishers() {
  try {
    const res = await $fetch('/api/admin/publishers')
    allPublishers.value = Array.isArray(res?.publishers) ? res.publishers : []
  } catch (err) {
    console.error('[broadcast] load publishers failed', err)
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function finish(summary) {
  stopPolling()
  result.value = summary
  sending.value = false
  // Reset the form for the next broadcast.
  selectedIds.value = []
  message.value = ''
  imageUrl.value = ''
}

// Poll the job status ~every 2s: keep the loading state and surface rising success/failed
// counts until the gateway reports done — or until progress stalls (gateway gone).
function startPolling(broadcastId) {
  let lastChangeAt = Date.now()
  let lastKey = ''
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const s = await $fetch(`/api/admin/broadcast/${broadcastId}`)
      progress.value = { sent: s?.sentCount ?? 0, failed: s?.failedCount ?? 0, total: s?.total ?? progress.value.total }
      const key = `${progress.value.sent}/${progress.value.failed}`
      if (key !== lastKey) { lastKey = key; lastChangeAt = Date.now() }
      if (s?.status === 'done') {
        finish(`הסתיים — נשלחו ${progress.value.sent}, נכשלו ${progress.value.failed}`)
      } else if (s?.status === 'failed') {
        stopPolling(); sending.value = false; error.value = 'שליחת ההודעות נכשלה'
      } else if (Date.now() - lastChangeAt > STALL_MS) {
        finish(`הסתיים (חלקי) — נשלחו ${progress.value.sent}, נכשלו ${progress.value.failed}`)
      }
    } catch {
      // transient poll failure — keep trying until the stall guard or a later success
    }
  }, POLL_MS)
}

async function send() {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  result.value = ''
  progress.value = { sent: 0, failed: 0, total: selectedIds.value.length }
  try {
    const res = await $fetch('/api/admin/broadcast', {
      method: 'POST',
      body: {
        publisherIds: selectedIds.value,
        message: message.value,
        imageUrl: imageUrl.value || undefined,
      },
    })
    if (res?.broadcastId) {
      progress.value.total = res.total ?? progress.value.total
      startPolling(res.broadcastId)
    } else {
      // No id (shouldn't happen) — fall back to a queued confirmation.
      finish(`נשלח ל-${res?.total ?? selectedIds.value.length} מפרסמים`)
    }
  } catch (err) {
    error.value = err?.data?.message || 'שליחת ההודעות נכשלה'
    sending.value = false
  }
}

onMounted(loadPublishers)
onUnmounted(stopPolling)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.BroadcastMessages {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &-back {
    display: none;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--brand-dark-green);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 600;
    @include mobile { display: inline-flex; }
  }

  &-header { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-title { margin: 0; font-size: var(--font-size-xl); font-weight: 700; color: var(--brand-dark-green); }
  &-desc { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); line-height: 1.6; }

  &-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  &-field { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-label { font-weight: 700; color: var(--color-text); font-size: var(--font-size-sm); }
  &-fieldHint { font-size: var(--font-size-xs); color: var(--color-text-light); }

  &-actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  &-error { margin: 0; color: var(--color-error); font-size: var(--font-size-sm); font-weight: 600; }
  &-success { margin: 0; color: var(--brand-dark-green); font-size: var(--font-size-sm); font-weight: 700; }
  &-progress {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    strong { color: var(--color-text); font-weight: 700; }
  }

  &-send {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm-lg) var(--spacing-2xl);
    border: none;
    border-radius: var(--radius-full);
    background: var(--brand-dark-green);
    color: #fff;
    font-family: var(--font-family-body);
    font-size: var(--font-size-md);
    font-weight: 700;
    cursor: pointer;
    justify-content: center;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }
  }

  &-sendIcon { transform: rotate(180deg); }

  &-spinner {
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: BroadcastMessages-spin 0.7s linear infinite;
  }
}

@keyframes BroadcastMessages-spin {
  to { transform: rotate(360deg); }
}
</style>

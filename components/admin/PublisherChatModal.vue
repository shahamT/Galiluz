<template>
  <div class="PubChat" @click.self="$emit('close')">
    <div class="PubChat-panel">
      <header class="PubChat-head">
        <div class="PubChat-headId">
          <span class="PubChat-headName">{{ name }}</span>
          <span class="PubChat-headPhone" dir="ltr">{{ formatPhone(phone) }}</span>
        </div>
        <button class="PubChat-close" aria-label="סגירה" @click="$emit('close')"><UiIcon name="close" size="sm" /></button>
      </header>

      <div ref="scroller" class="PubChat-body">
        <button v-if="!loading && messages.length >= count" class="PubChat-loadMore" :disabled="loading" @click="loadMore">טען הודעות נוספות</button>

        <p v-if="loading && !messages.length" class="PubChat-state">טוען…</p>
        <p v-else-if="error" class="PubChat-state PubChat-state--error">{{ error }}</p>
        <p v-else-if="!messages.length" class="PubChat-state">אין הודעות עדיין</p>

        <div
          v-for="(m, i) in ordered"
          :key="m.id || i"
          class="PubChat-msg"
          :class="m.direction === 'out' ? 'PubChat-msg--out' : 'PubChat-msg--in'"
        >
          <span class="PubChat-msgText">{{ m.text || '—' }}</span>
          <span v-if="m.timestamp" class="PubChat-msgTime">{{ formatTime(m.timestamp) }}</span>
        </div>
      </div>

      <footer class="PubChat-composer">
        <textarea
          v-model="text"
          class="PubChat-input"
          rows="1"
          placeholder="כתבו הודעה…"
          :disabled="sending"
          @keydown.enter.exact.prevent="send"
        />
        <button class="PubChat-send" :disabled="!text.trim() || sending" @click="send">
          <UiIcon name="send" size="sm" />
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminPublisherChatModal' })
const props = defineProps({
  publisherId: { type: String, required: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
})
defineEmits(['close'])

const messages = ref([])
const count = ref(20)
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const text = ref('')
const scroller = ref(null)

// Display oldest → newest (newest at the bottom, WhatsApp-style).
const ordered = computed(() => [...messages.value].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)))

const ERR = { gateway_unconfigured: 'שירות ההודעות אינו מוגדר', gateway_error: 'שגיאה בטעינת ההיסטוריה' }
function errMsg(e) { const m = e?.data?.message || e?.message || ''; return ERR[m] || 'שגיאה בטעינת ההיסטוריה' }

async function load(n) {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch(`/api/admin/chat/${props.publisherId}/history`, { params: { count: n } })
    messages.value = res?.messages || []
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}
function loadMore() { count.value += 20; load(count.value) }

async function send() {
  const message = text.value.trim()
  if (!message) return
  sending.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/chat/${props.publisherId}/send`, { method: 'POST', body: { message } })
    text.value = ''
    await load(count.value)
  } catch (e) {
    error.value = e?.data?.message === 'gateway_unconfigured' ? ERR.gateway_unconfigured : 'שליחת ההודעה נכשלה'
  } finally {
    sending.value = false
  }
}

function formatPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') && d.length === 12 ? `0${d.slice(3, 5)}-${d.slice(5)}` : (p || '') }
function formatTime(ts) { try { return new Date(ts * 1000).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

onMounted(() => load(count.value))
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PubChat {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-modal, 1000);
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  @include mobile { padding: 0; }

  &-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 30rem;
    height: 80vh;
    max-height: 40rem;
    background: var(--color-background);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg, 0 10px 40px rgba(0,0,0,0.3));
    @include mobile { max-width: none; height: 100vh; max-height: none; border-radius: 0; }
  }

  &-head {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm);
    padding: var(--spacing-md); background: var(--brand-dark-green); color: #fff; flex-shrink: 0;
  }
  &-headId { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  &-headName { font-weight: 700; }
  &-headPhone { font-size: var(--font-size-xs); opacity: 0.85; }
  &-close { display: inline-flex; background: transparent; border: none; color: #fff; cursor: pointer; padding: var(--spacing-xs); border-radius: var(--radius-md); &:hover { background: rgba(255,255,255,0.15); } }

  &-body {
    flex: 1; overflow-y: auto; padding: var(--spacing-md);
    display: flex; flex-direction: column; gap: var(--spacing-xs);
    background: var(--light-bg);
  }
  &-loadMore { align-self: center; margin-bottom: var(--spacing-sm); background: var(--color-background); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: var(--spacing-xs) var(--spacing-md); font-size: var(--font-size-xs); font-weight: 600; color: var(--brand-dark-green); cursor: pointer; }
  &-state { margin: auto; color: var(--color-text-light); font-size: var(--font-size-sm); &--error { color: #a12626; } }

  &-msg {
    max-width: 80%;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    display: flex; flex-direction: column; gap: 2px;
    word-break: break-word;
    &--out { align-self: flex-start; background: var(--brand-light-green-hover); color: var(--color-text); }
    &--in { align-self: flex-end; background: var(--color-background); color: var(--color-text); border: 1px solid var(--color-border); }
  }
  &-msgText { white-space: pre-wrap; }
  &-msgTime { font-size: 0.65rem; color: var(--color-text-light); align-self: flex-start; }

  &-composer { display: flex; gap: var(--spacing-sm); padding: var(--spacing-md); border-top: 1px solid var(--color-border); flex-shrink: 0; align-items: flex-end; }
  &-input {
    flex: 1; resize: none; max-height: 6rem; padding: var(--spacing-sm); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-size-sm); line-height: 1.4;
  }
  &-send {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 2.5rem; height: 2.5rem; border: none; border-radius: var(--radius-full);
    background: var(--brand-dark-green); color: #fff; cursor: pointer;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}
</style>

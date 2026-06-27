<template>
  <div class="AddGroupModal" @click.self="$emit('close')">
    <div class="AddGroupModal-card" role="dialog" aria-modal="true">
      <div class="AddGroupModal-header">
        <h2 class="AddGroupModal-title">{{ mode === 'log' ? 'בחירת קבוצת יומן' : 'הוספת קבוצה' }}</h2>
        <button type="button" class="AddGroupModal-close" aria-label="סגירה" @click="$emit('close')">
          <UiIcon name="close" size="sm" />
        </button>
      </div>

      <p class="AddGroupModal-hint">
        {{ mode === 'log'
          ? 'בחרו את הקבוצה שאליה יישלחו לוגים של החלטות הקראולר.'
          : 'בחרו קבוצה שמספר הוואטסאפ העסקי חבר בה. מוצגות רק קבוצות שעוד לא נוספו.' }}
      </p>

      <div v-if="loading" class="AddGroupModal-state">טוען קבוצות…</div>
      <div v-else-if="error" class="AddGroupModal-state AddGroupModal-state--error">
        טעינת הקבוצות נכשלה. <button type="button" class="AddGroupModal-retry" @click="load">נסו שוב</button>
      </div>
      <template v-else>
        <div class="AddGroupModal-search">
          <UiIcon name="search" size="sm" class="AddGroupModal-searchIcon" />
          <input v-model="query" type="search" class="AddGroupModal-input" placeholder="חיפוש קבוצה…" />
        </div>
        <div class="AddGroupModal-list">
          <button
            v-for="g in filtered"
            :key="g.chatId"
            type="button"
            class="AddGroupModal-row"
            :disabled="busy"
            @click="pick(g)"
          >
            <UiIcon name="groups" size="sm" class="AddGroupModal-rowIcon" />
            <span class="AddGroupModal-rowName">{{ g.name }}</span>
          </button>
          <p v-if="!filtered.length" class="AddGroupModal-empty">לא נמצאו קבוצות חדשות</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsAddGroupModal' })
const props = defineProps({
  existingChatIds: { type: Array, default: () => [] },
  // 'watch' → add to the crawler watch-list; 'log' → set the crawler-decision log group.
  mode: { type: String, default: 'watch' },
})
const emit = defineEmits(['close', 'added'])

const loading = ref(true)
const error = ref(false)
const busy = ref(false)
const groups = ref([])
const query = ref('')

const existing = computed(() => new Set(props.existingChatIds))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return groups.value
    .filter((g) => !existing.value.has(g.chatId))
    .filter((g) => !q || (g.name || '').toLowerCase().includes(q))
})

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = await $fetch('/api/admin/whatsapp-groups')
    groups.value = Array.isArray(res?.groups) ? res.groups : []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function pick(g) {
  if (busy.value) return
  busy.value = true
  try {
    const url = props.mode === 'log'
      ? '/api/admin/settings/crawler/log-group'
      : '/api/admin/settings/crawler/groups'
    await $fetch(url, { method: 'POST', body: { chatId: g.chatId, name: g.name } })
    emit('added')
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AddGroupModal {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-modal);
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);

  &-card {
    width: 100%;
    max-width: var(--modal-max-width);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-lg);
  }

  &-header { display: flex; align-items: center; justify-content: space-between; }
  &-title { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--brand-dark-green); }
  &-close {
    background: none; border: none; cursor: pointer; color: var(--color-text-light);
    border-radius: var(--radius-full); padding: 4px; display: inline-flex;
    &:hover { background: rgba(0,0,0,0.06); color: var(--color-text); }
  }
  &-hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); line-height: 1.5; }

  &-state { padding: var(--spacing-lg); text-align: center; color: var(--color-text-muted); &--error { color: var(--color-error); } }
  &-retry { background: none; border: none; color: var(--brand-dark-green); text-decoration: underline; cursor: pointer; font-family: inherit; }

  &-search { position: relative; }
  &-searchIcon { position: absolute; right: var(--spacing-sm); top: 50%; transform: translateY(-50%); color: var(--brand-dark-green); pointer-events: none; }
  &-input {
    width: 100%; height: var(--control-height); padding: 0 2.2rem 0 var(--spacing-sm);
    border: 1.5px solid var(--color-border); border-radius: var(--radius-md);
    font-family: var(--font-family-body); font-size: var(--font-size-sm); direction: rtl; box-sizing: border-box;
    &:focus { outline: none; border-color: var(--brand-dark-green); }
  }

  &-list { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; }
  &-row {
    display: flex; align-items: center; gap: var(--spacing-sm); width: 100%;
    padding: var(--spacing-sm); border: none; background: transparent; border-radius: var(--radius-md);
    cursor: pointer; font-family: var(--font-family-body); font-size: var(--font-size-sm); color: var(--color-text); text-align: right;
    &:hover { background: var(--light-bg); }
    &:disabled { opacity: 0.5; cursor: default; }
  }
  &-rowIcon { color: var(--color-text-light); flex-shrink: 0; }
  &-rowName { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &-empty { margin: 0; padding: var(--spacing-md); text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm); }
}
</style>

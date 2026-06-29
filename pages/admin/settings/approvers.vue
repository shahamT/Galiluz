<template>
  <div class="ApproversSettings">
    <!-- Mobile drill-in: back to the settings list -->
    <NuxtLink to="/admin/settings" class="ApproversSettings-back">
      <UiIcon name="arrow_forward" size="sm" />
      חזרה להגדרות
    </NuxtLink>

    <header class="ApproversSettings-header">
      <h1 class="ApproversSettings-title">ניהול מאשרים</h1>
      <p class="ApproversSettings-desc">
        המאשרים מקבלים בוואטסאפ בקשות הרשמה של מפרסמים חדשים ואירועים חדשים, ויכולים לאשר/לדחות/למחוק.
        כל המאשרים מקבלים את אותן ההודעות; הפעולה הראשונה קובעת, והשאר מקבלים עדכון שהפעולה כבר בוצעה.
      </p>
    </header>

    <section class="ApproversSettings-card">
      <div class="ApproversSettings-sectionHead">
        <h2 class="ApproversSettings-sectionTitle">מאשרים פעילים</h2>
      </div>
      <p class="ApproversSettings-sectionHint">בחרו מאשרים מתוך המפרסמים המאושרים במערכת.</p>

      <AdminPublisherSelect
        :model-value="null"
        :publishers="selectablePublishers"
        @update:model-value="onPicked"
      />

      <p v-if="noApprovers" class="ApproversSettings-note">
        לא הוגדרו מאשרים — בקשות הרשמה ואירועים חדשים לא יישלחו לאף אחד. הוסיפו לפחות מאשר אחד.
      </p>

      <ul v-if="approvers.length" class="ApproversSettings-list">
        <li v-for="a in approvers" :key="a.publisherId || a.waId" class="ApproversSettings-item">
          <UiIcon name="verified_user" size="sm" class="ApproversSettings-itemIcon" />
          <span class="ApproversSettings-itemName">
            {{ a.name }}
            <span v-if="a.isActive === false" class="ApproversSettings-itemPaused">מושהה</span>
            <span class="ApproversSettings-itemSub" dir="ltr">{{ formatPhone(a.waId) }}</span>
          </span>
          <button
            v-if="a.publisherId"
            type="button"
            class="ApproversSettings-remove"
            aria-label="הסרה"
            @click="remove(a.publisherId)"
          >
            <UiIcon name="delete" size="sm" />
          </button>
        </li>
      </ul>
      <p v-else class="ApproversSettings-empty">לא הוגדרו מאשרים עדיין.</p>
    </section>

    <!-- Test harness -->
    <section class="ApproversSettings-card">
      <div class="ApproversSettings-sectionHead">
        <h2 class="ApproversSettings-sectionTitle">בדיקת זרימת מאשרים</h2>
      </div>
      <p class="ApproversSettings-sectionHint">
        שליחת בקשת הרשמה של מפרסם דמה למאשרים המוגדרים — כדי לבדוק את זרימת האישור/דחייה בלי מספר נוסף.
        בסיום נקו את נתוני הבדיקה.
      </p>

      <div class="ApproversSettings-testActions">
        <button type="button" class="ApproversSettings-btn" :disabled="testBusy" @click="sendTestRequest">
          <UiIcon name="send" size="sm" /> שליחת בקשת הרשמה לבדיקה
        </button>
        <button type="button" class="ApproversSettings-btn ApproversSettings-btn--danger" :disabled="testBusy || !testDummyCount" @click="cleanupTest">
          <UiIcon name="delete_sweep" size="sm" /> ניקוי נתוני בדיקה{{ testDummyCount ? ` (${testDummyCount})` : '' }}
        </button>
      </div>

      <p v-if="testMsg" class="ApproversSettings-note" :class="{ 'ApproversSettings-note--ok': testOk }">{{ testMsg }}</p>
    </section>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsApprovers' })

const approvers = ref([])
const noApprovers = ref(false)
const allPublishers = ref([])

// Test harness
const testDummyCount = ref(0)
const testBusy = ref(false)
const testMsg = ref('')
const testOk = ref(false)

const approverIds = computed(() => new Set(approvers.value.map((a) => a.publisherId).filter(Boolean)))
// Picker shows approved publishers that aren't already approvers.
const selectablePublishers = computed(() =>
  allPublishers.value.filter((p) => p.status === 'approved' && !approverIds.value.has(p.id)),
)

function formatPhone(waId) {
  return (waId || '').replace(/^972/, '0')
}

async function loadApprovers() {
  const res = await $fetch('/api/admin/settings/approvers')
  approvers.value = Array.isArray(res?.approvers) ? res.approvers : []
  noApprovers.value = res?.noApprovers === true
  testDummyCount.value = res?.testDummyCount || 0
}

async function sendTestRequest() {
  if (testBusy.value) return
  testBusy.value = true
  testMsg.value = ''
  try {
    const res = await $fetch('/api/admin/settings/approvers/test-request', { method: 'POST' })
    testOk.value = (res?.approverCount || 0) > 0
    testMsg.value = res?.approverCount
      ? `בקשת בדיקה נשלחה ל-${res.approverCount} מאשרים. בדקו את הוואטסאפ.`
      : 'נוצרה בקשת בדיקה אך לא הוגדרו מאשרים — הוסיפו מאשר כדי לקבל את ההודעה.'
    await loadApprovers()
  } catch (err) {
    testOk.value = false
    testMsg.value = 'שליחת בקשת הבדיקה נכשלה.'
    console.error('[approvers-settings] test request failed', err)
  } finally {
    testBusy.value = false
  }
}

async function cleanupTest() {
  if (testBusy.value) return
  testBusy.value = true
  testMsg.value = ''
  try {
    const res = await $fetch('/api/admin/settings/approvers/test-cleanup', { method: 'POST' })
    testOk.value = true
    testMsg.value = `נמחקו ${res?.removed || 0} רשומות בדיקה.`
    await loadApprovers()
  } catch (err) {
    testOk.value = false
    testMsg.value = 'ניקוי נתוני הבדיקה נכשל.'
    console.error('[approvers-settings] test cleanup failed', err)
  } finally {
    testBusy.value = false
  }
}
async function loadPublishers() {
  const all = await $fetch('/api/admin/publishers')
  allPublishers.value = Array.isArray(all?.publishers) ? all.publishers : []
}

async function onPicked(pub) {
  if (!pub?.id) return
  try {
    await $fetch('/api/admin/settings/approvers', { method: 'POST', body: { publisherId: pub.id } })
    await loadApprovers()
  } catch (err) {
    console.error('[approvers-settings] add failed', err)
  }
}
async function remove(publisherId) {
  try {
    await $fetch(`/api/admin/settings/approvers/${encodeURIComponent(publisherId)}`, { method: 'DELETE' })
    await loadApprovers()
  } catch (err) {
    console.error('[approvers-settings] remove failed', err)
  }
}

onMounted(() => {
  loadApprovers()
  loadPublishers()
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.ApproversSettings {
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
    gap: var(--spacing-md);
  }

  &-sectionHead { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
  &-sectionTitle { margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--brand-dark-green); }
  &-sectionHint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: #9a6700;
    background: #fff7e6;
    border: 1px solid #ffe1a8;
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    &--ok { color: #1c7a44; background: #e3f6ea; border-color: #b7e4c7; }
  }

  &-testActions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  &-btn {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1.5px solid var(--brand-dark-green); border-radius: var(--radius-md);
    background: transparent; color: var(--brand-dark-green);
    font-family: var(--font-family-body); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: var(--brand-light-green-hover); }
    &:disabled { opacity: 0.5; cursor: default; }
    &--danger {
      border-color: var(--color-error); color: var(--color-error);
      &:hover:not(:disabled) { background: var(--color-error-tint-light); }
    }
  }

  &-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-item {
    display: flex; align-items: center; gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--light-bg); border-radius: var(--radius-md);
  }
  &-itemIcon { color: var(--color-text-light); flex-shrink: 0; }
  &-itemName { flex: 1; font-weight: 600; font-size: var(--font-size-sm); min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  &-itemSub { font-weight: 400; font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-itemPaused { align-self: flex-start; font-size: var(--font-size-xs); font-weight: 600; color: #a12626; background: rgba(211,51,51,0.12); border-radius: var(--radius-full); padding: 0.05rem 0.45rem; }
  &-remove {
    flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--color-text-light);
    border-radius: var(--radius-full); padding: 4px; display: inline-flex;
    &:hover { background: rgba(0,0,0,0.06); color: var(--color-error); }
  }
  &-empty { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
}
</style>

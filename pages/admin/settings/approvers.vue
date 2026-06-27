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

      <p v-if="usingEnvFallback" class="ApproversSettings-note">
        לא הוגדרו מאשרים — בינתיים בשימוש מאשר ברירת המחדל מההגדרה הישנה. הוסיפו מאשר כדי לנהל מהפורטל.
      </p>

      <ul v-if="approvers.length" class="ApproversSettings-list">
        <li v-for="a in approvers" :key="a.publisherId || a.waId" class="ApproversSettings-item">
          <UiIcon name="verified_user" size="sm" class="ApproversSettings-itemIcon" />
          <span class="ApproversSettings-itemName">
            {{ a.name }}
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
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminSettingsApprovers' })

const approvers = ref([])
const usingEnvFallback = ref(false)
const allPublishers = ref([])

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
  usingEnvFallback.value = res?.usingEnvFallback === true
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
  &-remove {
    flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--color-text-light);
    border-radius: var(--radius-full); padding: 4px; display: inline-flex;
    &:hover { background: rgba(0,0,0,0.06); color: var(--color-error); }
  }
  &-empty { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
}
</style>

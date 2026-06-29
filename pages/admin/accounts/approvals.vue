<template>
  <div class="ApprList">
    <div class="ApprList-header">
      <h1 class="ApprList-title">בקשות אישור</h1>
      <p class="ApprList-desc">מפרסמים שנרשמו וממתינים לאישור.</p>
    </div>

    <div class="ApprList-container">
      <p v-if="notice" class="ApprList-notice">{{ notice }}</p>

      <template v-if="pending">
        <div v-for="i in 3" :key="i" class="ApprList-skeleton" />
      </template>

      <template v-else-if="requests.length">
        <div class="ApprList-rows">
          <div v-for="r in requests" :key="r.id" class="ApprCard">
            <div class="ApprCard-head">
              <span class="ApprCard-name">{{ r.name || '—' }}</span>
              <span class="ApprCard-date">{{ formatDate(r.createdAt) }}</span>
            </div>
            <div class="ApprCard-rows">
              <div class="ApprCard-row"><UiIcon name="call" size="xs" /> <span dir="ltr">{{ formatPhone(r.phone) }}</span></div>
              <div v-if="r.email" class="ApprCard-row"><UiIcon name="mail" size="xs" /> {{ r.email }}</div>
              <div v-if="r.accountName" class="ApprCard-row"><UiIcon name="apartment" size="xs" /> {{ r.accountName }}</div>
              <div v-if="r.eventTypesDescription" class="ApprCard-row"><UiIcon name="local_activity" size="xs" /> {{ r.eventTypesDescription }}</div>
            </div>
            <div v-if="canAct" class="ApprCard-actions">
              <button class="ApprCard-btn ApprCard-btn--approve" :disabled="busy" @click="act(r, 'approve')">
                <UiIcon name="check" size="sm" /> אישור
              </button>
              <button class="ApprCard-btn ApprCard-btn--reject" :disabled="busy" @click="act(r, 'reject')">
                <UiIcon name="close" size="sm" /> דחייה
              </button>
            </div>
          </div>
        </div>
      </template>

      <PublisherDashboardEmptyState v-else text="אין בקשות ממתינות 🎉" :show-button="false" />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminApprovals' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'בקשות אישור | ניהול | גלילו"ז' })

const authStore = useAuthStore()
const canAct = computed(() => authStore.isSuperAdmin) // viewer is read-only; super_admin/owner can act

const { data, pending, refresh } = await useAuthFetch('/api/admin/approvals')
const { refresh: refreshCount } = useApprovalsCount()
const requests = computed(() => data.value?.pending || [])

const busy = ref(false)
const notice = ref('')

async function act(r, kind) {
  const ok = confirm(kind === 'approve' ? `לאשר את ${r.name}?` : `לדחות את ${r.name}? פעולה זו תמחק את הבקשה.`)
  if (!ok) return
  busy.value = true
  notice.value = ''
  try {
    const res = await $fetch(`/api/admin/approvals/${r.id}/${kind}`, { method: 'POST' })
    if (res?.applied === false) {
      const by = res.by ? ` על ידי ${res.by}` : ''
      notice.value = res.resolvedStatus === 'approved' ? `הבקשה כבר אושרה${by}.` : `הבקשה כבר טופלה${by}.`
    } else {
      notice.value = kind === 'approve' ? `${r.name} אושר/ה ✅` : `${r.name} נדחה/תה`
    }
    await Promise.all([refresh(), refreshCount()])
  } catch (e) {
    notice.value = e?.data?.message === 'manager_only' ? 'אין לך הרשאה לפעולה זו' : 'הפעולה נכשלה'
  } finally {
    busy.value = false
  }
}

function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '')
  if (d.startsWith('972') && d.length === 12) return `0${d.slice(3, 5)}-${d.slice(5)}`
  return p || ''
}
function formatDate(v) {
  if (!v) return ''
  try { return new Date(v).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.ApprList {
  &-header { margin-bottom: var(--spacing-xl); }
  &-title { margin: 0 0 var(--spacing-xs); font-size: var(--font-size-2xl); font-weight: 700; color: var(--brand-dark-green); }
  &-desc { margin: 0; font-size: var(--font-size-base); color: var(--color-text-light); }

  &-container {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    @include mobile { padding: var(--spacing-md); }
  }

  &-notice {
    margin: 0 0 var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--brand-light-green-hover);
    color: var(--brand-dark-green);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  &-rows { display: flex; flex-direction: column; gap: var(--spacing-md); }

  &-skeleton {
    height: 7rem; border-radius: var(--radius-lg); margin-bottom: var(--spacing-md);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%; animation: apprShimmer 1.4s infinite;
    @keyframes apprShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  }
}

.ApprCard {
  padding: var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  border-inline-start: 3px solid #e0a83e;

  &-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
  &-name { font-weight: 700; font-size: var(--font-size-lg); color: var(--color-text); }
  &-date { font-size: var(--font-size-sm); color: var(--color-text-light); flex-shrink: 0; }

  &-rows { display: flex; flex-direction: column; gap: 0.35rem; }
  &-row { display: flex; align-items: center; gap: var(--spacing-sm); font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-actions { display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md); }
  &-btn {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    background: var(--color-background); font-family: inherit; font-size: var(--font-size-sm); font-weight: 600;
    cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
    &--approve { background: var(--brand-dark-green); color: #fff; border-color: var(--brand-dark-green); }
    &--reject:hover { background: rgba(211, 51, 51, 0.12); color: #a12626; border-color: #a12626; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}
</style>

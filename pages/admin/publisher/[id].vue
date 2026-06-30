<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="PubDetail">
      <NuxtLink to="/admin/accounts/publishers" class="PubDetail-back">
        <UiIcon name="arrow_forward" size="sm" /> חזרה למפרסמים
      </NuxtLink>

      <template v-if="pending">
        <div class="PubDetail-skeleton" style="height: 7rem" />
        <div class="PubDetail-skeleton" style="height: 10rem" />
      </template>

      <template v-else-if="pub">
        <!-- Header -->
        <div class="PubDetail-header" :class="{ 'PubDetail-header--muted': !pub.isActive }">
          <span class="PubDetail-avatar">{{ initials(pub.name) }}</span>
          <div class="PubDetail-headMain">
            <div class="PubDetail-titleRow">
              <template v-if="canManage && editingName">
                <input v-model="nameDraft" class="PubDetail-titleInput" type="text" maxlength="80" @keyup.enter="saveName" />
                <button class="PubDetail-btn PubDetail-btn--primary" :disabled="busy" @click="saveName">שמירה</button>
                <button class="PubDetail-btn" @click="cancelName">ביטול</button>
              </template>
              <template v-else>
                <h1 class="PubDetail-title">{{ pub.name }}</h1>
                <button v-if="canManage" class="PubDetail-iconBtn" title="עריכת שם" @click="startName"><UiIcon name="edit" size="sm" /></button>
                <span class="PubDetail-chip" :class="`PubDetail-chip--${pub.status}`">{{ statusLabel(pub.status) }}</span>
                <span v-if="!pub.isActive" class="PubDetail-chip PubDetail-chip--danger">מושהה</span>
              </template>
            </div>
            <div class="PubDetail-meta">
              <span class="PubDetail-metaItem"><UiIcon name="call" size="xs" /> <span dir="ltr">{{ formatPhone(pub.phone) }}</span></span>
              <span v-if="pub.email" class="PubDetail-metaItem"><UiIcon name="mail" size="xs" /> {{ pub.email }}</span>
              <span class="PubDetail-metaItem"><UiIcon name="event_note" size="xs" /> {{ pub.eventCount }} אירועים</span>
              <span v-if="pub.createdAt" class="PubDetail-metaItem">נרשם {{ formatDate(pub.createdAt) }}</span>
            </div>
            <p v-if="pub.eventTypesDescription" class="PubDetail-types">{{ pub.eventTypesDescription }}</p>
            <div v-if="canManage" class="PubDetail-headActions">
              <button class="PubDetail-btn" @click="showChat = true"><UiIcon name="chat" size="sm" /> שליחת הודעה</button>
            </div>
          </div>
        </div>

        <p v-if="actionError" class="PubDetail-error">{{ actionError }}</p>

        <!-- Accounts -->
        <section class="PubDetail-card">
          <h2 class="PubDetail-cardTitle">חשבונות</h2>
          <div class="PubDetail-accounts">
            <div v-for="a in accounts" :key="a.accountId" class="PubDetail-account">
              <NuxtLink :to="`/admin/account/${a.accountId}`" class="PubDetail-accountName">
                <UiIcon :name="a.kind === 'platform' ? 'shield_person' : 'apartment'" size="xs" /> {{ a.title }}
              </NuxtLink>
              <div class="PubDetail-accountSide">
                <span class="PubDetail-chip PubDetail-chip--role">{{ roleLabel(a.role) }}</span>
                <button
                  v-if="canManage && a.kind === 'business'"
                  class="PubDetail-iconBtn PubDetail-iconBtn--danger"
                  title="הסרה מהחשבון" :disabled="busy"
                  @click="removeFromAccount(a)"
                ><UiIcon name="link_off" size="sm" /></button>
              </div>
            </div>
            <p v-if="!accounts.length" class="PubDetail-empty">לא משויך לאף חשבון</p>
          </div>

          <div v-if="canManage && addableAccounts.length" class="PubDetail-add">
            <select v-model="addAccountId" class="PubDetail-select">
              <option value="">הוספה לחשבון…</option>
              <option v-for="a in addableAccounts" :key="a.id" :value="a.id">{{ a.title }}</option>
            </select>
            <button class="PubDetail-btn PubDetail-btn--primary" :disabled="!addAccountId || busy" @click="addToAccount">הוספה כמנהל</button>
          </div>
        </section>

        <!-- Lifecycle actions -->
        <section v-if="canManageLifecycle" class="PubDetail-card PubDetail-card--danger">
          <h2 class="PubDetail-cardTitle">פעולות</h2>
          <div class="PubDetail-actions">
            <button class="PubDetail-btn" :disabled="busy" @click="toggleActive">
              <UiIcon :name="pub.isActive ? 'block' : 'check_circle'" size="sm" />
              {{ pub.isActive ? 'השהיית מפרסם (חסימת כניסה)' : 'הפעלה מחדש' }}
            </button>
            <button class="PubDetail-btn PubDetail-btn--danger" :disabled="busy" @click="showDelete = !showDelete">
              <UiIcon name="delete" size="sm" /> מחיקה והעברת אירועים
            </button>
          </div>

          <div v-if="showDelete" class="PubDetail-delete">
            <p class="PubDetail-deleteHint">
              כל {{ pub.eventCount }} האירועים של המפרסם יועברו למפרסם אחר (ולחשבון שלו), והמפרסם יימחק (בשקט, ללא הודעה).
            </p>
            <AdminPublisherSelect v-model="deleteTarget" :publishers="transferCandidates" />
            <button class="PubDetail-btn PubDetail-btn--danger" :disabled="!deleteTarget || busy" @click="doDelete">
              מחיקה והעברה ל{{ deleteTarget?.name || '…' }}
            </button>
          </div>
        </section>

        <AdminPublisherChatModal
          v-if="showChat"
          :publisher-id="String(route.params.id)"
          :name="pub.name"
          :phone="pub.phone"
          @close="showChat = false"
        />
      </template>

      <PublisherDashboardEmptyState v-else text="המפרסם לא נמצא" :show-button="false" />
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminPublisherDetail' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'מפרסם | ניהול | גלילו"ז' })

const route = useRoute()
const authStore = useAuthStore()
const canManage = computed(() => authStore.isSuperAdmin)
// Lifecycle (deactivate/delete): super_admin for regular publishers, but a platform STAFFER's lifecycle
// is owner-only governance, and the platform_owner is never deactivatable/deletable.
const canManageLifecycle = computed(() =>
  authStore.isSuperAdmin && !pub.value?.isPlatformOwner && (!pub.value?.isPlatformStaff || authStore.isPlatformOwner),
)

const { data, pending, refresh } = await useAuthFetch(`/api/admin/publisher/${route.params.id}`)
const pub = computed(() => data.value?.publisher || null)
const accounts = computed(() => data.value?.accounts || [])

const { data: acctData } = await useAuthFetch('/api/admin/accounts')
const addableAccounts = computed(() => {
  const memberIds = new Set(accounts.value.map((a) => a.accountId))
  return (acctData.value?.accounts || []).filter((a) => a.kind === 'business' && !memberIds.has(a.id))
})

const { data: pubData } = await useAuthFetch('/api/admin/publishers')
// Exclude self + deactivated publishers (events shouldn't land with someone who can't log in).
const transferCandidates = computed(() => (pubData.value?.publishers || []).filter((p) => p.id !== route.params.id && p.isActive !== false))

const ROLE_LABELS = { owner: 'בעלים', admin: 'מנהל', super_admin: 'מנהל-על', viewer: 'צופה', platform_owner: 'בעלים' }
function roleLabel(r) { return ROLE_LABELS[r] || r }
function statusLabel(s) { return ({ approved: 'מאושר', pending: 'ממתין', ghost: 'צללית' })[s] || s }

const ERR = {
  cannot_deactivate_self: 'לא ניתן להשהות את עצמך',
  cannot_deactivate_owner: 'לא ניתן להשהות את בעלי הפלטפורמה',
  cannot_delete_self: 'לא ניתן למחוק את עצמך',
  cannot_delete_owner: 'לא ניתן למחוק את בעלי הפלטפורמה',
  publisher_needs_one_account: 'לכל מפרסם חייב להיות לפחות חשבון אחד',
  cannot_remove_owner: 'לא ניתן להסיר בעלים מחשבון',
  manager_only: 'אין לך הרשאה לפעולה זו',
}
const actionError = ref('')
const busy = ref(false)
const showChat = ref(false)
function errMsg(e) { const m = e?.data?.message || e?.message || ''; return ERR[m] || 'הפעולה נכשלה' }
async function run(fn, after) { busy.value = true; actionError.value = ''; try { await fn(); if (after) await after(); else await refresh() } catch (e) { actionError.value = errMsg(e) } finally { busy.value = false } }

// Name editing (mirrors the account title edit)
const editingName = ref(false)
const nameDraft = ref('')
function startName() { nameDraft.value = pub.value?.name || ''; editingName.value = true }
function cancelName() { editingName.value = false }
function saveName() {
  const fullName = nameDraft.value.trim()
  if (!fullName) { actionError.value = 'יש להזין שם'; return }
  run(async () => {
    await $fetch(`/api/admin/publisher/${route.params.id}`, { method: 'PATCH', body: { fullName } })
    editingName.value = false
  })
}

// Accounts
const addAccountId = ref('')
function addToAccount() {
  if (!addAccountId.value) return
  const accountId = addAccountId.value
  run(async () => {
    await $fetch(`/api/admin/account/${accountId}/members`, { method: 'PATCH', body: { action: 'add', publisherId: route.params.id, role: 'admin' } })
    addAccountId.value = ''
  })
}
function removeFromAccount(a) {
  if (!confirm(`להסיר את ${pub.value.name} מהחשבון "${a.title}"?`)) return
  run(() => $fetch(`/api/admin/account/${a.accountId}/members`, { method: 'PATCH', body: { action: 'remove', publisherId: route.params.id } }))
}

// Lifecycle
function toggleActive() {
  const next = !pub.value.isActive
  if (!next && !confirm(`להשהות את ${pub.value.name}? המפרסם לא יוכל להתחבר (הנתונים נשמרים).`)) return
  run(() => $fetch(`/api/admin/publisher/${route.params.id}/active`, { method: 'PATCH', body: { isActive: next } }))
}

const showDelete = ref(false)
const deleteTarget = ref(null)
function doDelete() {
  if (!deleteTarget.value) return
  if (!confirm(`למחוק את ${pub.value.name} ולהעביר את כל האירועים אל ${deleteTarget.value.name}? פעולה זו אינה הפיכה.`)) return
  run(
    () => $fetch(`/api/admin/publisher/${route.params.id}/delete`, { method: 'POST', body: { targetPublisherId: deleteTarget.value.id } }),
    () => navigateTo('/admin/accounts/publishers'),
  )
}

function initials(name) { return (String(name || '').trim().charAt(0) || '?').toUpperCase() }
function formatPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') && d.length === 12 ? `0${d.slice(3, 5)}-${d.slice(5)}` : (p || '') }
function formatDate(v) { if (!v) return ''; try { return new Date(v).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' } }
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PubDetail {
  flex: 1; display: flex; flex-direction: column; gap: var(--spacing-lg);
  @include mobile { padding-inline: var(--spacing-md); }

  &-back {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    color: var(--brand-dark-green); text-decoration: none; font-weight: 600; font-size: var(--font-size-sm);
    &:hover { text-decoration: underline; }
  }

  &-skeleton {
    border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%; animation: pubDetailShimmer 1.4s infinite;
    @keyframes pubDetailShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  }

  &-header {
    display: flex; gap: var(--spacing-lg); align-items: flex-start;
    background: var(--color-background); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--spacing-lg);
    &--muted { opacity: 0.7; }
    @include mobile { flex-direction: column; }
  }
  &-avatar {
    flex-shrink: 0; width: 4rem; height: 4rem; border-radius: var(--radius-md);
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--light-bg); color: var(--brand-dark-green); font-size: var(--font-size-xl); font-weight: 700;
  }
  &-headMain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); }
  &-titleRow { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
  &-title { margin: 0; font-size: var(--font-size-2xl); font-weight: 700; color: var(--brand-dark-green); }
  &-titleInput {
    flex: 1; min-width: 12rem; padding: var(--spacing-sm); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); font-size: var(--font-size-lg); font-family: inherit;
  }
  &-meta { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
  &-metaItem { display: inline-flex; align-items: center; gap: 0.25rem; font-size: var(--font-size-sm); color: var(--color-text-light); }
  &-types { margin: 0; font-size: var(--font-size-sm); color: var(--color-text); }
  &-headActions { margin-top: var(--spacing-xs); }

  &-error { margin: 0; padding: var(--spacing-sm) var(--spacing-md); background: rgba(211,51,51,0.12); color: #a12626; border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; }

  &-card { background: var(--color-background); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--spacing-lg); }
  &-card--danger { border: 1px solid rgba(211,51,51,0.25); }
  &-cardTitle { margin: 0 0 var(--spacing-md); font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); }

  &-accounts { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-account {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-md);
  }
  &-accountName { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-weight: 600; color: var(--color-text); text-decoration: none; &:hover { color: var(--brand-dark-green); } }
  &-accountSide { display: flex; align-items: center; gap: var(--spacing-sm); flex-shrink: 0; }

  &-add { display: flex; align-items: center; gap: var(--spacing-sm); margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border); @include mobile { flex-direction: column; align-items: stretch; } }

  &-actions { display: flex; gap: var(--spacing-sm); flex-wrap: wrap; }
  &-delete { margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: var(--spacing-sm); }
  &-deleteHint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-select { padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); font-family: inherit; font-size: var(--font-size-sm); }

  &-btn {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-md);
    background: var(--color-background); font-family: inherit; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    &--primary { background: var(--brand-dark-green); color: #fff; border-color: var(--brand-dark-green); }
    &--danger { color: #a12626; border-color: rgba(211,51,51,0.4); &:hover { background: rgba(211,51,51,0.12); } }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  &-iconBtn {
    display: inline-flex; align-items: center; justify-content: center; padding: var(--spacing-xs);
    border: none; background: transparent; color: var(--color-text-light); border-radius: var(--radius-md); cursor: pointer;
    &:hover { background: var(--light-bg); }
    &--danger:hover { background: rgba(211,51,51,0.12); color: #a12626; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &-chip {
    display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: 600;
    &--role { background: var(--brand-light-green-hover); color: var(--brand-dark-green); }
    &--approved { background: var(--brand-light-green-hover); color: var(--brand-dark-green); }
    &--pending { background: rgba(224,168,62,0.20); color: #8a5a00; }
    &--ghost { background: var(--color-border); color: var(--color-text-light); }
    &--danger { background: rgba(211,51,51,0.14); color: #a12626; }
  }

  &-empty { margin: 0; padding: var(--spacing-md); text-align: center; color: var(--color-text-light); }
}
</style>

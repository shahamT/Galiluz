<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="AcctDetail">
      <NuxtLink to="/admin/accounts" class="AcctDetail-back">
        <UiIcon name="arrow_forward" size="sm" /> חזרה לחשבונות
      </NuxtLink>

      <template v-if="pending">
        <div class="AcctDetail-skeleton" style="height: 7rem" />
        <div class="AcctDetail-skeleton" style="height: 14rem" />
      </template>

      <template v-else-if="account">
        <!-- Header -->
        <div class="AcctDetail-header">
          <span class="AcctDetail-logo" :class="{ 'AcctDetail-logo--platform': account.kind === 'platform' }">
            <img v-if="account.logo" :src="account.logo" alt="" class="AcctDetail-logoImg" />
            <UiIcon v-else :name="account.kind === 'platform' ? 'shield_person' : 'apartment'" size="lg" />
          </span>

          <div class="AcctDetail-headMain">
            <div class="AcctDetail-titleRow">
              <template v-if="canEdit && editingTitle">
                <input v-model="titleDraft" class="AcctDetail-titleInput" type="text" />
                <button class="AcctDetail-btn AcctDetail-btn--primary" :disabled="busy" @click="saveTitle">שמירה</button>
                <button class="AcctDetail-btn" @click="cancelTitle">ביטול</button>
              </template>
              <template v-else>
                <h1 class="AcctDetail-title">{{ account.title || '—' }}</h1>
                <button v-if="canEdit" class="AcctDetail-iconBtn" title="עריכת שם" @click="startTitle"><UiIcon name="edit" size="sm" /></button>
              </template>
            </div>
            <div class="AcctDetail-meta">
              <span class="AcctDetail-chip" :class="account.kind === 'platform' ? 'AcctDetail-chip--platform' : 'AcctDetail-chip--neutral'">
                {{ account.kind === 'platform' ? 'פלטפורמה' : 'עסקי' }}
              </span>
              <span class="AcctDetail-metaItem"><UiIcon name="event_note" size="xs" /> {{ account.eventCount }} אירועים</span>
              <span v-if="account.createdAt" class="AcctDetail-metaItem">נוצר {{ formatDate(account.createdAt) }}</span>
            </div>
            <label v-if="canEdit" class="AcctDetail-logoUpload">
              <UiIcon name="photo_camera" size="xs" /> {{ account.logo ? 'החלפת לוגו' : 'העלאת לוגו' }}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onLogoChange" />
            </label>
          </div>
        </div>

        <p v-if="actionError" class="AcctDetail-error">{{ actionError }}</p>

        <!-- Members -->
        <section class="AcctDetail-card">
          <h2 class="AcctDetail-cardTitle">{{ account.kind === 'platform' ? 'צוות הפלטפורמה' : 'חברי החשבון' }}</h2>

          <div class="AcctDetail-members">
            <div v-for="m in members" :key="m.publisherId" class="AcctDetail-member" :class="{ 'AcctDetail-member--muted': !m.isActive }">
              <div class="AcctDetail-memberId">
                <span class="AcctDetail-memberName">{{ m.name }}</span>
                <span class="AcctDetail-memberPhone" dir="ltr">{{ formatPhone(m.phone) }}</span>
              </div>
              <div class="AcctDetail-memberCtl">
                <template v-if="canEdit && !isImmutable(m)">
                  <select class="AcctDetail-select" :value="m.role" :disabled="busy" @change="setRole(m, $event.target.value)">
                    <option v-for="r in settableRoles" :key="r.value" :value="r.value">{{ r.label }}</option>
                  </select>
                  <button class="AcctDetail-iconBtn AcctDetail-iconBtn--danger" title="הסרה" :disabled="busy" @click="removeMember(m)">
                    <UiIcon name="person_remove" size="sm" />
                  </button>
                </template>
                <span v-else class="AcctDetail-chip AcctDetail-chip--role">{{ roleLabel(m.role) }}</span>
              </div>
            </div>
            <p v-if="!members.length" class="AcctDetail-empty">אין חברים בחשבון</p>
          </div>

          <!-- Add member -->
          <div v-if="canEdit" class="AcctDetail-add">
            <div class="AcctDetail-addSelect">
              <AdminPublisherSelect v-model="addPub" :publishers="addCandidates" />
            </div>
            <select v-if="addRoles.length > 1" v-model="addRole" class="AcctDetail-select">
              <option v-for="r in addRoles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
            <button class="AcctDetail-btn AcctDetail-btn--primary" :disabled="!addPub || busy" @click="addMember">הוספה</button>
          </div>
        </section>

        <!-- Feature entitlements (business only) -->
        <section v-if="account.kind === 'business'" class="AcctDetail-card">
          <h2 class="AcctDetail-cardTitle">הרשאות חשבון</h2>
          <div class="AcctDetail-features">
            <label v-for="f in FEATURES" :key="f.key" class="AcctDetail-feature">
              <input
                type="checkbox"
                :checked="account.features?.[f.key] === true"
                :disabled="!canEdit || busy"
                @change="toggleFeature(f.key, $event.target.checked)"
              />
              <span>{{ f.label }}</span>
            </label>
          </div>
        </section>

        <!-- Danger zone: delete a business account (platform account can't be deleted). -->
        <section v-if="canEdit && account.kind === 'business'" class="AcctDetail-card AcctDetail-card--danger">
          <h2 class="AcctDetail-cardTitle">מחיקת חשבון</h2>
          <p class="AcctDetail-deleteHint">
            {{ members.length
              ? `לחשבון ${members.length} משתמשים — בעת מחיקה יש לבחור חשבון יעד שאליו יועברו (עם אותו תפקיד; הבעלים יהפוך למנהל). גם האירועים יועברו.`
              : 'החשבון ריק וניתן למחיקה.' }}
          </p>
          <div v-if="members.length" class="AcctDetail-deleteRow">
            <select v-model="deleteTarget" class="AcctDetail-select">
              <option value="">בחירת חשבון יעד…</option>
              <option v-for="a in targetCandidates" :key="a.id" :value="a.id">{{ a.title }}</option>
            </select>
            <button class="AcctDetail-btn AcctDetail-btn--danger" :disabled="!deleteTarget || busy" @click="deleteAccount">מחיקה והעברה</button>
          </div>
          <button v-else class="AcctDetail-btn AcctDetail-btn--danger" :disabled="busy" @click="deleteAccount">מחיקת החשבון</button>
        </section>
      </template>

      <PublisherDashboardEmptyState v-else text="החשבון לא נמצא" :show-button="false" />
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
import { ACCOUNT_FEATURES } from '~/consts/features.const.js'

defineOptions({ name: 'AdminAccountDetail' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'חשבון | ניהול | גלילו"ז' })

const route = useRoute()
const authStore = useAuthStore()
const FEATURES = ACCOUNT_FEATURES

const { data, pending, refresh } = await useAuthFetch(`/api/admin/account/${route.params.id}`)
const account = computed(() => data.value?.account || null)
const members = computed(() => data.value?.members || [])

// Edit permission mirrors the server gate: platform → owner, business → super_admin.
const canEdit = computed(() =>
  account.value?.kind === 'platform' ? authStore.isPlatformOwner : authStore.isSuperAdmin,
)

const BUSINESS_ROLES = [{ value: 'owner', label: 'בעלים' }, { value: 'admin', label: 'מנהל' }]
const PLATFORM_ROLES = [{ value: 'super_admin', label: 'מנהל-על' }, { value: 'viewer', label: 'צופה' }]
const settableRoles = computed(() => (account.value?.kind === 'platform' ? PLATFORM_ROLES : BUSINESS_ROLES))
const ROLE_LABELS = { owner: 'בעלים', admin: 'מנהל', super_admin: 'מנהל-על', viewer: 'צופה', platform_owner: 'בעלים' }
function roleLabel(r) { return ROLE_LABELS[r] || r }
// Locked rows show a chip (no select/remove): the platform owner, and a business account's owner
// (ownership changes only by promoting another member, which transfers it).
function isImmutable(m) { return account.value?.kind === 'platform' ? m.role === 'platform_owner' : m.role === 'owner' }

const ERR = {
  transfer_owner_instead: 'כדי להחליף בעלים יש להפוך מנהל אחר לבעלים',
  cannot_remove_owner: 'לא ניתן להסיר את בעלי החשבון — יש להעביר בעלות תחילה',
  publisher_needs_one_account: 'לא ניתן להסיר — לכל מפרסם חייב להיות לפחות חשבון אחד',
  cannot_modify_platform_owner: 'לא ניתן לשנות את בעלי הפלטפורמה',
  already_member: 'המפרסם כבר חבר בחשבון',
  not_a_member: 'המפרסם אינו חבר בחשבון',
  invalid_role: 'תפקיד לא חוקי',
  cannot_delete_platform: 'לא ניתן למחוק את חשבון הפלטפורמה',
  target_required: 'יש לבחור חשבון יעד',
  invalid_target: 'חשבון יעד לא תקין',
  platform_owner_only: 'רק בעלי הפלטפורמה יכול לבצע פעולה זו',
  manager_only: 'אין לך הרשאה לפעולה זו',
}
const actionError = ref('')
const busy = ref(false)
function errMsg(e) { const m = e?.data?.message || e?.message || ''; return ERR[m] || 'הפעולה נכשלה' }

async function run(fn) {
  busy.value = true
  actionError.value = ''
  try { await fn(); await refresh() }
  catch (e) { actionError.value = errMsg(e) }
  finally { busy.value = false }
}

// Title editing
const editingTitle = ref(false)
const titleDraft = ref('')
function startTitle() { titleDraft.value = account.value?.title || ''; editingTitle.value = true }
function cancelTitle() { editingTitle.value = false }
function saveTitle() {
  const title = titleDraft.value.trim()
  if (!title) { actionError.value = 'יש להזין שם חשבון'; return }
  run(async () => {
    await $fetch(`/api/admin/account/${route.params.id}`, { method: 'PATCH', body: { title } })
    editingTitle.value = false
  })
}

// Members
async function setRole(m, role) {
  if (role === m.role) return
  // Promoting to owner transfers ownership — confirm, and on cancel reset the <select> visual.
  if (role === 'owner' && account.value?.kind === 'business') {
    if (!confirm(`להפוך את ${m.name} לבעלים? הבעלים הנוכחי יהפוך למנהל.`)) { await refresh(); return }
  }
  run(() => $fetch(`/api/admin/account/${route.params.id}/members`, { method: 'PATCH', body: { action: 'setRole', publisherId: m.publisherId, role } }))
}
function removeMember(m) {
  if (!confirm(`להסיר את ${m.name} מהחשבון?`)) return
  run(() => $fetch(`/api/admin/account/${route.params.id}/members`, { method: 'PATCH', body: { action: 'remove', publisherId: m.publisherId } }))
}

// Add member — business members are added as admin only (owner is assigned later by promotion).
const ADD_BUSINESS = [{ value: 'admin', label: 'מנהל' }]
const ADD_PLATFORM = [{ value: 'super_admin', label: 'מנהל-על' }, { value: 'viewer', label: 'צופה' }]
const addRoles = computed(() => (account.value?.kind === 'platform' ? ADD_PLATFORM : ADD_BUSINESS))
const addPub = ref(null)
const addRole = ref('admin')
watch(addRoles, (r) => { if (r.length && !r.some((x) => x.value === addRole.value)) addRole.value = r[0].value }, { immediate: true })
const { data: pubData } = await useAuthFetch('/api/admin/publishers')
const addCandidates = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.publisherId))
  return (pubData.value?.publishers || []).filter((p) => !memberIds.has(p.id))
})

// Account deletion — when there are members, pick a business target to move them (+ events) to.
const { data: acctData } = await useAuthFetch('/api/admin/accounts')
const deleteTarget = ref('')
const targetCandidates = computed(() => (acctData.value?.accounts || []).filter((a) => a.kind === 'business' && a.id !== route.params.id))
async function deleteAccount() {
  const hasMembers = members.value.length > 0
  if (hasMembers && !deleteTarget.value) return
  const msg = hasMembers
    ? `למחוק את החשבון ולהעביר ${members.value.length} משתמשים + האירועים לחשבון שנבחר? הבעלים יהפוך למנהל.`
    : `למחוק את החשבון "${account.value?.title}"?`
  if (!confirm(msg)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/account/${route.params.id}/delete`, { method: 'POST', body: hasMembers ? { targetAccountId: deleteTarget.value } : {} })
    await navigateTo('/admin/accounts')
  } catch (e) { actionError.value = errMsg(e) } finally { busy.value = false }
}
function addMember() {
  if (!addPub.value) return
  const publisherId = addPub.value.id
  run(async () => {
    await $fetch(`/api/admin/account/${route.params.id}/members`, { method: 'PATCH', body: { action: 'add', publisherId, role: addRole.value } })
    addPub.value = null
  })
}

// Features (business)
function toggleFeature(key, value) {
  run(() => $fetch(`/api/admin/account/${route.params.id}`, { method: 'PATCH', body: { features: { [key]: value } } }))
}

// Logo
function onLogoChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = String(reader.result).split(',')[1] || ''
    run(() => $fetch(`/api/admin/account/${route.params.id}/logo`, { method: 'POST', body: { file: base64, mimetype: file.type, filename: file.name } }))
  }
  reader.readAsDataURL(file)
  e.target.value = ''
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

.AcctDetail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  @include mobile { padding-inline: var(--spacing-md); }

  &-back {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--brand-dark-green);
    text-decoration: none;
    font-weight: 600;
    font-size: var(--font-size-sm);
    &:hover { color: var(--brand-dark-green); text-decoration: underline; }
  }

  &-skeleton {
    border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.6) 50%, var(--color-border) 75%);
    background-size: 200% 100%; animation: acctDetailShimmer 1.4s infinite;
    @keyframes acctDetailShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  }

  &-header {
    display: flex;
    gap: var(--spacing-lg);
    align-items: flex-start;
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-lg);
    @include mobile { flex-direction: column; align-items: stretch; }
  }

  &-logo {
    flex-shrink: 0;
    width: 5rem; height: 5rem;
    border-radius: var(--radius-md);
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--light-bg); color: var(--brand-dark-green); overflow: hidden;
    &--platform { background: var(--brand-dark-green); color: #fff; }
  }
  &-logoImg { width: 100%; height: 100%; object-fit: cover; }

  &-headMain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); }
  &-titleRow { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
  &-title { margin: 0; font-size: var(--font-size-2xl); font-weight: 700; color: var(--brand-dark-green); }
  &-titleInput {
    flex: 1; min-width: 12rem; padding: var(--spacing-sm); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); font-size: var(--font-size-lg); font-family: inherit;
  }

  &-meta { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
  &-metaItem { display: inline-flex; align-items: center; gap: 0.25rem; font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-logoUpload {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    align-self: flex-start;
    font-size: var(--font-size-sm); font-weight: 600; color: var(--brand-dark-green);
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }

  &-error {
    margin: 0; padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(211, 51, 51, 0.12); color: #a12626;
    border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600;
  }

  &-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--spacing-lg);
  }
  &-card--danger { border: 1px solid rgba(211,51,51,0.25); }
  &-cardTitle { margin: 0 0 var(--spacing-md); font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); }
  &-deleteHint { margin: 0 0 var(--spacing-md); font-size: var(--font-size-sm); color: var(--color-text-light); }
  &-deleteRow { display: flex; gap: var(--spacing-sm); align-items: center; @include mobile { flex-direction: column; align-items: stretch; } }

  &-members { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  &-member {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    &--muted { opacity: 0.6; }
  }
  &-memberId { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  &-memberName { font-weight: 600; color: var(--color-text); }
  &-memberPhone { font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-memberCtl { display: flex; align-items: center; gap: var(--spacing-sm); flex-shrink: 0; }

  &-select {
    padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); background: var(--color-background); font-family: inherit;
    font-size: var(--font-size-sm); cursor: pointer;
  }

  &-add {
    display: flex; align-items: center; gap: var(--spacing-sm);
    margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border);
    @include mobile { flex-direction: column; align-items: stretch; }
  }
  &-addSelect { flex: 1; min-width: 0; }

  &-features { display: flex; flex-direction: column; gap: var(--spacing-sm); }
  &-feature { display: flex; align-items: center; gap: var(--spacing-sm); font-size: var(--font-size-base); cursor: pointer; }

  &-btn {
    padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); background: var(--color-background); font-family: inherit;
    font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    &--primary { background: var(--brand-dark-green); color: #fff; border-color: var(--brand-dark-green); }
    &--danger { color: #a12626; border-color: rgba(211,51,51,0.4); &:hover { background: rgba(211,51,51,0.12); } }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  &-iconBtn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: var(--spacing-xs); border: none; background: transparent; color: var(--color-text-light);
    border-radius: var(--radius-md); cursor: pointer;
    &:hover { background: var(--light-bg); color: var(--color-text); }
    &--danger:hover { background: rgba(211,51,51,0.12); color: #a12626; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &-chip {
    display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
    font-size: var(--font-size-xs); font-weight: 600;
    &--platform { background: var(--brand-dark-green); color: #fff; }
    &--neutral { background: var(--color-border); color: var(--color-text-light); }
    &--role { background: var(--brand-light-green-hover); color: var(--brand-dark-green); }
  }

  &-empty { margin: 0; padding: var(--spacing-md); text-align: center; color: var(--color-text-light); }
}
</style>

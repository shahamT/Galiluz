<template>
  <LayoutProtectedShell>
    <template #nav>
      <AdminNavTabs />
    </template>

    <div class="AdminSecurity">
      <div class="AdminSecurity-header">
        <h1 class="AdminSecurity-title">אבטחת חשבון</h1>
        <p class="AdminSecurity-subtitle">
          מפתחות גישה (Passkeys) הם גורם האימות השני לכניסת צוות — טביעת אצבע, זיהוי פנים או מפתח אבטחה.
          הם עמידים בפני פישינג ואינם ניתנים להעתקה.
        </p>
      </div>

      <div v-if="authStore.mfaEnrollRequired" class="AdminSecurity-banner">
        כדי להמשיך יש להוסיף לפחות מפתח גישה אחד. לאחר ההוספה תתבקשו אליו בכל כניסה.
      </div>

      <div class="AdminSecurity-card">
        <h2 class="AdminSecurity-cardTitle">מפתחות הגישה שלי</h2>

        <p v-if="loadError" class="AdminSecurity-error">{{ loadError }}</p>
        <p v-else-if="loading && !credentials.length" class="AdminSecurity-muted">טוען…</p>
        <p v-else-if="!credentials.length" class="AdminSecurity-muted">לא הוגדרו עדיין מפתחות גישה.</p>

        <ul v-else class="AdminSecurity-list">
          <li v-for="c in credentials" :key="c.id" class="AdminSecurity-item">
            <div class="AdminSecurity-itemMain">
              <span class="AdminSecurity-itemName">{{ c.deviceName || 'מפתח גישה' }}</span>
              <span class="AdminSecurity-itemMeta">
                נוצר {{ formatDate(c.createdAt) }}<template v-if="c.lastUsedAt"> · שימוש אחרון {{ formatDate(c.lastUsedAt) }}</template>
              </span>
            </div>
            <button class="AdminSecurity-removeBtn" :disabled="busy" @click="remove(c.id)">הסרה</button>
          </li>
        </ul>
      </div>

      <div class="AdminSecurity-add">
        <input
          v-model="newName"
          type="text"
          class="AdminSecurity-input"
          placeholder="שם המכשיר (לא חובה) — למשל: לפטופ עבודה"
          :disabled="busy"
          maxlength="60"
        />
        <button class="AdminSecurity-addBtn" :disabled="busy" @click="add">
          <span v-if="busy" class="AdminSecurity-spinner" />
          <template v-else>הוספת מפתח גישה</template>
        </button>
      </div>
      <p v-if="addError" class="AdminSecurity-error">{{ addError }}</p>
    </div>
  </LayoutProtectedShell>
</template>

<script setup>
defineOptions({ name: 'AdminSecurity' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'אבטחת חשבון | גלילו"ז' })

const authStore = useAuthStore()
const { registerPasskey, listPasskeys, deletePasskey, checkAuth } = useAuth()

const credentials = ref([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const addError = ref('')
const newName = ref('')

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try { credentials.value = await listPasskeys() }
  catch { loadError.value = 'טעינת המפתחות נכשלה' }
  finally { loading.value = false }
}

async function add() {
  if (busy.value) return
  addError.value = ''
  busy.value = true
  try {
    const res = await registerPasskey(newName.value.trim())
    credentials.value = res.credentials || credentials.value
    newName.value = ''
    // Adding the first passkey clears the enrollment requirement — refresh the session
    // (so the middleware lets them through) and leave the forced page.
    if (authStore.mfaEnrollRequired) {
      await checkAuth()
      navigateTo('/admin')
    }
  } catch (err) {
    const msg = err?.data?.message
    if (msg === 'already_enrolled') addError.value = 'מפתח זה כבר רשום.'
    else addError.value = 'הוספת המפתח נכשלה או בוטלה. ודאו שהמכשיר תומך במפתחות גישה ונסו שוב.'
  } finally {
    busy.value = false
  }
}

async function remove(id) {
  if (busy.value) return
  busy.value = true
  try {
    await deletePasskey(id)
    await load()
  } catch {
    addError.value = 'הסרת המפתח נכשלה'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminSecurity {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 40rem;

  @include mobile {
    padding-inline: var(--spacing-md);
  }

  &-header { margin-bottom: var(--spacing-lg); }

  &-title {
    margin: 0 0 var(--spacing-xs);
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-subtitle {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  &-banner {
    background: var(--brand-dark-green-tint-light);
    border: 1px solid var(--brand-light-green);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    font-weight: 600;
    color: var(--brand-dark-green);
  }

  &-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
  }

  &-cardTitle {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  &-muted { margin: 0; color: var(--color-text-light); }
  &-error { margin: var(--spacing-sm) 0 0; color: var(--color-error); font-weight: 500; }

  &-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); }

  &-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  &-itemMain { display: flex; flex-direction: column; gap: 2px; }
  &-itemName { font-weight: 600; }
  &-itemMeta { font-size: var(--font-size-sm); color: var(--color-text-light); }

  &-removeBtn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    color: var(--color-error);
    font-family: var(--font-family-body);
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &-add {
    display: flex;
    gap: var(--spacing-sm);
    align-items: stretch;

    @include mobile { flex-direction: column; }
  }

  &-input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    outline: none;
    &:focus { border-color: var(--brand-dark-green); }
  }

  &-addBtn {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    white-space: nowrap;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &-spinner {
    width: 1rem; height: 1rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: adminSecSpin 0.7s linear infinite;
  }
  @keyframes adminSecSpin { to { transform: rotate(360deg); } }
}
</style>

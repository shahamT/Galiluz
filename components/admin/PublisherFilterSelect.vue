<template>
  <div class="AdminPublisherFilter">
    <!-- Trigger -->
    <button
      ref="triggerRef"
      type="button"
      class="AdminPublisherFilter-trigger"
      :class="{ 'AdminPublisherFilter-trigger--active': !!modelValue }"
      @click="toggle"
    >
      <UiIcon name="filter_list" size="sm" class="AdminPublisherFilter-triggerIcon" />
      <span v-if="!modelValue" class="AdminPublisherFilter-placeholder">סינון לפי חשבון או מפרסם</span>
      <template v-else>
        <span class="AdminPublisherFilter-tag">{{ modelValue.kind === 'account' ? 'חשבון' : 'מפרסם' }}</span>
        <span class="AdminPublisherFilter-selectedLabel">{{ modelValue.label }}</span>
        <span
          class="AdminPublisherFilter-clear"
          role="button"
          aria-label="ניקוי סינון"
          @click.stop="clear"
        >
          <UiIcon name="close" size="sm" />
        </span>
      </template>
      <UiIcon name="expand_more" size="sm" class="AdminPublisherFilter-chevron" :class="{ 'AdminPublisherFilter-chevron--open': open }" />
    </button>

    <!-- Panel -->
    <div v-if="open" ref="panelRef" class="AdminPublisherFilter-panel">
      <!-- Tabs -->
      <div class="AdminPublisherFilter-tabs" role="group">
        <button
          type="button"
          class="AdminPublisherFilter-tab"
          :class="{ 'AdminPublisherFilter-tab--active': activeTab === 'accounts' }"
          @click="activeTab = 'accounts'"
        >חשבונות</button>
        <button
          type="button"
          class="AdminPublisherFilter-tab"
          :class="{ 'AdminPublisherFilter-tab--active': activeTab === 'publishers' }"
          @click="activeTab = 'publishers'"
        >מפרסמים</button>
      </div>

      <!-- Search -->
      <div class="AdminPublisherFilter-search">
        <UiIcon name="search" size="sm" class="AdminPublisherFilter-searchIcon" />
        <input
          ref="searchRef"
          v-model="search"
          type="search"
          class="AdminPublisherFilter-input"
          :placeholder="activeTab === 'accounts' ? 'חיפוש חשבון...' : 'חיפוש מפרסם, טלפון או חשבון...'"
        />
      </div>

      <!-- List -->
      <div class="AdminPublisherFilter-list">
        <!-- Clear / show all -->
        <button type="button" class="AdminPublisherFilter-allRow" @click="clear">
          <UiIcon name="list" size="sm" />
          <span>כל האירועים (ללא סינון)</span>
          <UiIcon v-if="!modelValue" name="check" size="sm" class="AdminPublisherFilter-check" />
        </button>

        <!-- Accounts -->
        <template v-if="activeTab === 'accounts'">
          <button
            v-for="acc in filteredAccounts"
            :key="acc.id"
            type="button"
            class="AdminPublisherFilter-row"
            :class="{ 'AdminPublisherFilter-row--selected': modelValue?.kind === 'account' && modelValue.id === acc.id }"
            @click="selectAccount(acc)"
          >
            <UiIcon name="apartment" size="sm" class="AdminPublisherFilter-rowIcon" />
            <span class="AdminPublisherFilter-rowName">{{ acc.name }}</span>
          </button>
          <p v-if="!filteredAccounts.length" class="AdminPublisherFilter-empty">לא נמצאו חשבונות</p>
        </template>

        <!-- Publishers -->
        <template v-else>
          <button
            v-for="pub in filteredPublishers"
            :key="pub.id"
            type="button"
            class="AdminPublisherFilter-row"
            :class="{ 'AdminPublisherFilter-row--selected': modelValue?.kind === 'publisher' && modelValue.id === pub.id }"
            @click="selectPublisher(pub)"
          >
            <UiIcon name="person" size="sm" class="AdminPublisherFilter-rowIcon" />
            <span class="AdminPublisherFilter-pubMain">
              <span class="AdminPublisherFilter-rowName">{{ pub.name }}</span>
              <span v-if="pub.phone" class="AdminPublisherFilter-pubPhone" dir="ltr">{{ formatPhone(pub.phone) }}</span>
            </span>
            <span v-if="pub.accountName" class="AdminPublisherFilter-chip">
              <span class="AdminPublisherFilter-chipText">{{ pub.accountName }}</span>
            </span>
          </button>
          <p v-if="!filteredPublishers.length" class="AdminPublisherFilter-empty">לא נמצאו מפרסמים</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminPublisherFilterSelect' })

const props = defineProps({
  modelValue: { type: Object, default: null }, // { kind: 'account'|'publisher', id, label, accountName? } | null
  accounts: { type: Array, default: () => [] },
  publishers: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const activeTab = ref('accounts')
// One shared query across both tabs, so switching account⇄publisher keeps filtering by it.
const search = ref('')
const triggerRef = ref(null)
const panelRef = ref(null)
const searchRef = ref(null)

onClickOutside(panelRef, () => { open.value = false }, { ignore: [triggerRef] })

function toggle() {
  open.value = !open.value
  if (open.value) nextTick(() => searchRef.value?.focus())
}

const filteredAccounts = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.accounts
  return props.accounts.filter(a => (a.name || '').toLowerCase().includes(q))
})

const filteredPublishers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.publishers
  return props.publishers.filter(p =>
    (p.name || '').toLowerCase().includes(q)
    || (p.phone || '').toLowerCase().includes(q)
    || (p.accountName || '').toLowerCase().includes(q)
  )
})

function selectAccount(acc) {
  emit('update:modelValue', { kind: 'account', id: acc.id, label: acc.name })
  open.value = false
}

function selectPublisher(pub) {
  emit('update:modelValue', { kind: 'publisher', id: pub.id, label: pub.name, accountName: pub.accountName })
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
  open.value = false
}

function formatPhone(waId) {
  return waId.replace(/^972/, '0')
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AdminPublisherFilter {
  position: relative;
  width: 100%;

  &-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color 0.15s;

    @include mobile { height: var(--section-header-height); }

    &:hover { border-color: var(--brand-dark-green); }
    &--active { border-color: var(--brand-dark-green); }
  }

  &-triggerIcon { color: var(--brand-dark-green); flex-shrink: 0; }

  &-placeholder { color: var(--color-text-muted); flex: 1; text-align: right; }

  &-tag {
    flex-shrink: 0;
    padding: 0.1rem 0.5rem;
    border-radius: var(--radius-full);
    background: var(--brand-light-green-hover);
    color: var(--brand-dark-green);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  &-selectedLabel {
    flex: 1;
    text-align: right;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-text-light);
    border-radius: var(--radius-full);
    padding: 2px;
    transition: background 0.15s, color 0.15s;

    &:hover { background: rgba(0, 0, 0, 0.06); color: var(--color-text); }
  }

  &-chevron {
    flex-shrink: 0;
    color: var(--color-text-light);
    transition: transform 0.15s;
    &--open { transform: rotate(180deg); }
  }

  &-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--spacing-xs);
    background: var(--color-background);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-index-modal);
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  // ── Tabs (segmented control) ──
  &-tabs {
    display: flex;
    align-items: stretch;
    height: var(--control-height);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px;
    gap: 1px;
  }

  &-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    color: var(--color-text-light);
    background: transparent;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;

    &:hover:not(.AdminPublisherFilter-tab--active) { background: rgba(0, 0, 0, 0.05); }

    &--active {
      background: var(--color-background);
      color: var(--brand-dark-green);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  }

  // ── Search ──
  &-search { position: relative; }

  &-searchIcon {
    position: absolute;
    right: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    color: var(--brand-dark-green);
    pointer-events: none;
  }

  &-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 2.2rem 0 var(--spacing-sm);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    background: var(--color-background);
    direction: rtl;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &::placeholder { color: var(--color-text-muted); }
    &:focus { outline: none; border-color: var(--brand-dark-green); }
  }

  // ── List ──
  &-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 18rem;
    overflow-y: auto;
  }

  &-allRow,
  &-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    text-align: right;
    transition: background 0.15s;

    &:hover { background: var(--light-bg); }
  }

  &-allRow {
    color: var(--color-text-light);
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    margin-bottom: var(--spacing-xs);
    padding-bottom: var(--spacing-sm);
  }

  &-check { margin-inline-start: auto; color: var(--brand-dark-green); }

  &-row--selected {
    background: var(--brand-light-green-hover);
    &:hover { background: var(--brand-light-green-hover); }
  }

  &-rowIcon { color: var(--color-text-light); flex-shrink: 0; }

  &-rowName {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // Publisher row: name + phone stacked, account chip on the side
  &-pubMain {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &-pubPhone {
    font-size: var(--font-size-xs);
    color: var(--color-text-light);
    text-align: right;
  }

  &-chip {
    flex-shrink: 1;
    max-width: 9rem;
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
    background: rgba(128, 220, 218, 0.18);
    color: var(--brand-dark-blue);
    font-size: var(--font-size-xs);
    font-weight: 500;
    min-width: 0;
  }

  &-chipText {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-empty {
    margin: 0;
    padding: var(--spacing-md);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
}
</style>

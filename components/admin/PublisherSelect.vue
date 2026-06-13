<template>
  <div class="AdminPublisherSelect">
    <!-- Trigger -->
    <button
      ref="triggerRef"
      type="button"
      class="AdminPublisherSelect-trigger"
      :class="{ 'AdminPublisherSelect-trigger--active': !!modelValue, 'AdminPublisherSelect-trigger--error': hasError }"
      @click="toggle"
    >
      <UiIcon name="person_search" size="sm" class="AdminPublisherSelect-triggerIcon" />
      <span v-if="!modelValue" class="AdminPublisherSelect-placeholder">בחר מפרסם...</span>
      <template v-else>
        <span class="AdminPublisherSelect-selectedName">{{ modelValue.name }}</span>
        <span
          class="AdminPublisherSelect-clear"
          role="button"
          aria-label="ניקוי"
          @click.stop="$emit('update:modelValue', null)"
        >
          <UiIcon name="close" size="sm" />
        </span>
      </template>
      <UiIcon name="expand_more" size="sm" class="AdminPublisherSelect-chevron" :class="{ 'AdminPublisherSelect-chevron--open': open }" />
    </button>

    <!-- Panel -->
    <div v-if="open" ref="panelRef" class="AdminPublisherSelect-panel">
      <div class="AdminPublisherSelect-search">
        <UiIcon name="search" size="sm" class="AdminPublisherSelect-searchIcon" />
        <input
          ref="searchRef"
          v-model="query"
          type="search"
          class="AdminPublisherSelect-input"
          placeholder="חיפוש לפי שם, טלפון או חשבון..."
          @keydown.esc="open = false"
        />
      </div>

      <div class="AdminPublisherSelect-list">
        <button
          v-for="pub in filtered"
          :key="pub.id"
          type="button"
          class="AdminPublisherSelect-row"
          :class="{
            'AdminPublisherSelect-row--selected': modelValue?.id === pub.id,
            'AdminPublisherSelect-row--current': pub.id === disabledId,
          }"
          :disabled="pub.id === disabledId"
          @click="select(pub)"
        >
          <UiIcon name="person" size="sm" class="AdminPublisherSelect-rowIcon" />
          <span class="AdminPublisherSelect-pubMain">
            <span class="AdminPublisherSelect-rowName">{{ pub.name }}</span>
            <span v-if="pub.phone" class="AdminPublisherSelect-pubPhone" dir="ltr">{{ formatPhone(pub.phone) }}</span>
          </span>
          <span v-if="pub.id === disabledId" class="AdminPublisherSelect-chip AdminPublisherSelect-chip--current">
            <span class="AdminPublisherSelect-chipText">בעלים נוכחי</span>
          </span>
          <span v-else-if="pub.accountName" class="AdminPublisherSelect-chip">
            <span class="AdminPublisherSelect-chipText">{{ pub.accountName }}</span>
          </span>
        </button>
        <p v-if="!filtered.length" class="AdminPublisherSelect-empty">לא נמצאו מפרסמים</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminPublisherSelect' })

const props = defineProps({
  modelValue:  { type: Object, default: null }, // { id, name, phone, accountName } | null
  publishers:  { type: Array,  default: () => [] },
  hasError:    { type: Boolean, default: false },
  disabledId:  { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const query = ref('')
const triggerRef = ref(null)
const panelRef = ref(null)
const searchRef = ref(null)

onClickOutside(panelRef, () => { open.value = false }, { ignore: [triggerRef] })

function toggle() {
  open.value = !open.value
  if (open.value) nextTick(() => searchRef.value?.focus())
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.publishers
  return props.publishers.filter(p => {
    const formattedPhone = (p.phone || '').replace(/^972/, '0')
    return (p.name || '').toLowerCase().includes(q)
      || (p.phone || '').toLowerCase().includes(q)
      || formattedPhone.includes(q)
      || (p.accountName || '').toLowerCase().includes(q)
  })
})

function select(pub) {
  emit('update:modelValue', pub)
  open.value = false
  query.value = ''
}

function formatPhone(waId) {
  return waId.replace(/^972/, '0')
}
</script>

<style lang="scss">
.AdminPublisherSelect {
  position: relative;
  width: 100%;

  &-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color 0.15s;
    box-sizing: border-box;

    &:hover { border-color: var(--brand-dark-green); }
    &--active { border-color: var(--brand-dark-green); }
    &--error { border-color: var(--color-error, #d32f2f); }
  }

  &-triggerIcon { color: var(--brand-dark-green); flex-shrink: 0; }
  &-placeholder { color: var(--color-text-muted); flex: 1; text-align: right; }

  &-selectedName {
    flex: 1;
    font-weight: 600;
    text-align: right;
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

  &-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 16rem;
    overflow-y: auto;
  }

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
    &--selected { background: var(--brand-light-green-hover); &:hover { background: var(--brand-light-green-hover); } }
    &--current  { opacity: 0.5; cursor: not-allowed; &:hover { background: transparent; } }
  }

  &-rowIcon { color: var(--color-text-light); flex-shrink: 0; }

  &-pubMain {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &-rowName {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    &--current { background: var(--color-border); color: var(--color-text-muted); }
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

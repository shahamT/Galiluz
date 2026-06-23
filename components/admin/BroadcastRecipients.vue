<template>
  <div ref="rootEl" class="BroadcastRecipients">
    <!-- The "To" field — one row of chips, opens the picker on click -->
    <div
      ref="fieldEl"
      class="BroadcastRecipients-field"
      :class="{ 'BroadcastRecipients-field--open': open }"
      @click="open = !open"
    >
      <div class="BroadcastRecipients-chips">
        <span v-if="allSelected" class="BroadcastRecipients-chip BroadcastRecipients-chip--all">
          כל המפרסמים המאושרים ({{ publishers.length }})
        </span>
        <template v-else-if="selectedPublishers.length">
          <span v-for="p in visibleChips" :key="p.id" class="BroadcastRecipients-chip">
            <span class="BroadcastRecipients-chipText">{{ p.name }}</span>
            <button
              type="button"
              class="BroadcastRecipients-chipX"
              :aria-label="`הסרת ${p.name}`"
              @click.stop="toggle(p.id)"
            >
              <UiIcon name="close" size="sm" />
            </button>
          </span>
          <span v-if="hiddenCount > 0" class="BroadcastRecipients-chip BroadcastRecipients-chip--more">
            +{{ hiddenCount }}
          </span>
        </template>
        <span v-else class="BroadcastRecipients-placeholder">בחרו מפרסמים…</span>
      </div>
      <UiIcon name="expand_more" size="sm" class="BroadcastRecipients-caret" />

      <!-- Hidden measurer: renders ALL selected chips invisibly so we can compute how many fit -->
      <div ref="measurerEl" class="BroadcastRecipients-measurer" aria-hidden="true">
        <span v-for="p in selectedPublishers" :key="p.id" class="BroadcastRecipients-chip">
          <span class="BroadcastRecipients-chipText">{{ p.name }}</span>
          <span class="BroadcastRecipients-chipX"><UiIcon name="close" size="sm" /></span>
        </span>
      </div>
    </div>

    <!-- Picker dropdown -->
    <div v-if="open" class="BroadcastRecipients-dropdown">
      <input
        v-model="search"
        type="text"
        class="BroadcastRecipients-search"
        placeholder="חיפוש מפרסם…"
        @click.stop
      />
      <button type="button" class="BroadcastRecipients-allRow" @click.stop="toggleAll">
        <span class="BroadcastRecipients-check" :class="{ 'BroadcastRecipients-check--on': allSelected }">
          <UiIcon v-if="allSelected" name="check" size="sm" />
        </span>
        <span>בחירת כל המפרסמים</span>
        <span class="BroadcastRecipients-count">{{ publishers.length }}</span>
      </button>
      <ul class="BroadcastRecipients-list">
        <li v-for="p in filtered" :key="p.id">
          <button type="button" class="BroadcastRecipients-option" @click.stop="toggle(p.id)">
            <span class="BroadcastRecipients-check" :class="{ 'BroadcastRecipients-check--on': isSelected(p.id) }">
              <UiIcon v-if="isSelected(p.id)" name="check" size="sm" />
            </span>
            <span class="BroadcastRecipients-optionMain">
              <span class="BroadcastRecipients-optionName">{{ p.name }}</span>
              <span v-if="p.accountName && p.accountName !== p.name" class="BroadcastRecipients-optionAccount">{{ p.accountName }}</span>
            </span>
            <span class="BroadcastRecipients-optionPhone" dir="ltr">{{ formatPhone(p.phone) }}</span>
          </button>
        </li>
        <li v-if="!filtered.length" class="BroadcastRecipients-empty">לא נמצאו מפרסמים</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminBroadcastRecipients' })

const props = defineProps({
  modelValue: { type: Array, default: () => [] }, // selected publisher ids
  publishers: { type: Array, default: () => [] }, // [{ id, name, phone }]
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const search = ref('')
const rootEl = ref(null)
const fieldEl = ref(null)
const measurerEl = ref(null)
const maxVisible = ref(99)

const selectedSet = computed(() => new Set(props.modelValue))
const allSelected = computed(() => props.publishers.length > 0 && props.modelValue.length === props.publishers.length)

// Selected publishers in source order (stable chip order).
const selectedPublishers = computed(() => props.publishers.filter((p) => selectedSet.value.has(p.id)))

const visibleChips = computed(() => (allSelected.value ? [] : selectedPublishers.value.slice(0, maxVisible.value)))
const hiddenCount = computed(() => (allSelected.value ? 0 : Math.max(0, selectedPublishers.value.length - maxVisible.value)))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.publishers
  return props.publishers.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q))
})

function isSelected(id) {
  return selectedSet.value.has(id)
}
function formatPhone(phone) {
  return (phone || '').replace(/^972/, '0')
}

function toggle(id) {
  const next = new Set(props.modelValue)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  // Preserve source order in the emitted array.
  emit('update:modelValue', props.publishers.filter((p) => next.has(p.id)).map((p) => p.id))
}
function toggleAll() {
  emit('update:modelValue', allSelected.value ? [] : props.publishers.map((p) => p.id))
}

// Measure how many chips fit on one row; the rest collapse into a "+K" chip.
function recompute() {
  if (allSelected.value || !selectedPublishers.value.length) return
  const field = fieldEl.value
  const measurer = measurerEl.value
  if (!field || !measurer) return
  const GAP = 6 // matches the chips gap
  const RESERVE = 72 // space for the caret + a "+K" chip
  const available = field.clientWidth - RESERVE
  const children = Array.from(measurer.children)
  let used = 0
  let count = 0
  for (const child of children) {
    const w = child.getBoundingClientRect().width
    const next = used + (count > 0 ? GAP : 0) + w
    if (next > available) break
    used = next
    count++
  }
  // If everything fits, show all (no "+K"); otherwise keep at least one chip.
  maxVisible.value = count >= children.length ? children.length : Math.max(1, count)
}

function onDocMouseDown(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}

let ro = null
onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  ro = new ResizeObserver(() => recompute())
  if (fieldEl.value) ro.observe(fieldEl.value)
  nextTick(recompute)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  ro?.disconnect()
})
watch([() => props.modelValue, () => props.publishers], () => nextTick(recompute), { deep: true })
</script>

<style lang="scss">
.BroadcastRecipients {
  position: relative;

  &-field {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: var(--control-height);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    cursor: pointer;
    overflow: hidden;

    &--open,
    &:hover { border-color: var(--brand-dark-green); }
  }

  // One row only; the measurer computes how many chips fit.
  &-chips {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  &-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    max-width: 14rem;
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-full);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-weight: 600;

    &--all { background: var(--brand-dark-green); color: #fff; }
    &--more { background: var(--color-border); color: var(--color-text); }
  }

  &-chipText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &-chipX {
    display: inline-flex;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    &:hover { opacity: 1; }
  }

  &-placeholder { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  &-caret { flex-shrink: 0; color: var(--color-text-light); }

  // Off-screen measurement copy of all chips. Clipped (max-width + overflow:hidden) so the
  // wide nowrap row never extends the page's scroll area — children still lay out at natural
  // width, so getBoundingClientRect() on them stays accurate.
  &-measurer {
    position: absolute;
    top: 0;
    left: 0;
    max-width: 100%;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    display: flex;
    gap: 6px;
    white-space: nowrap;
  }

  &-dropdown {
    position: absolute;
    z-index: 50;
    top: calc(100% + 4px);
    inset-inline: 0;
    max-height: 18rem;
    overflow-y: auto;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-xs);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-search {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    direction: rtl;
    margin-bottom: var(--spacing-xs);
    &:focus { border-color: var(--brand-dark-green); outline: none; }
  }

  &-allRow,
  &-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    text-align: start;
    color: var(--color-text);
    &:hover { background: var(--light-bg); }
  }
  &-allRow { font-weight: 700; border-bottom: 1px solid var(--color-border); border-radius: 0; }
  &-count { margin-inline-start: auto; font-size: var(--font-size-xs); color: var(--color-text-light); }

  &-check {
    flex-shrink: 0;
    width: 1.1rem;
    height: 1.1rem;
    border: 1.5px solid var(--color-border);
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    &--on { background: var(--brand-dark-green); border-color: var(--brand-dark-green); }
  }

  &-optionMain { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--spacing-xs); }
  &-optionName { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &-optionAccount { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-optionPhone { flex-shrink: 0; font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-empty { padding: var(--spacing-sm) var(--spacing-md); color: var(--color-text-muted); font-size: var(--font-size-sm); }
}
</style>

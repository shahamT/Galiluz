<template>
  <div class="CityPicker">
    <FormField label="ישוב" required :error="errors?.city">
      <div ref="pickerEl" class="CityPicker-input" :class="{ 'CityPicker-input--open': isOpen, 'CityPicker-input--filled': displayValue }" @click="openDropdown">
        <span class="CityPicker-inputText" :class="{ 'CityPicker-inputText--placeholder': !displayValue }">
          {{ displayValue || 'בחרו ישוב...' }}
        </span>
        <UiIcon name="expand_more" size="sm" class="CityPicker-chevron" />
      </div>

      <Teleport to="body">
        <div v-if="isOpen" class="CityPicker-backdrop" @click="closeDropdown" />
        <div v-if="isOpen" class="CityPicker-dropdown" :style="dropdownStyle">
          <div class="CityPicker-search">
            <input
              ref="searchEl"
              v-model="search"
              type="text"
              class="CityPicker-searchInput"
              placeholder="חיפוש ישוב..."
              @click.stop
            />
          </div>
          <!-- Custom city — always pinned top -->
          <div
            class="CityPicker-option CityPicker-option--custom"
            :class="{ 'CityPicker-option--selected': isCustom }"
            @click="selectCustom"
          >ישוב אחר (לא ברשימה)</div>
          <div class="CityPicker-divider" />
          <!-- Filtered cities -->
          <div class="CityPicker-list">
            <template v-if="filteredCities.length">
              <div
                v-for="city in filteredCities"
                :key="city.id"
                class="CityPicker-option"
                :class="{ 'CityPicker-option--selected': modelValue.cityId === city.id }"
                @click="selectCity(city)"
              >{{ city.title }}</div>
            </template>
            <div v-else class="CityPicker-noResults">לא נמצאו תוצאות</div>
          </div>
        </div>
      </Teleport>
    </FormField>

    <!-- Custom city fields -->
    <template v-if="isCustom">
      <FormField label="שם הישוב" required :error="errors?.customCity">
        <input
          :value="modelValue.customCity"
          type="text"
          class="FormInput"
          placeholder="הזינו שם ישוב"
          maxlength="40"
          @input="update({ customCity: $event.target.value })"
        />
      </FormField>

      <div class="CityPicker-regionField">
        <div class="CityPicker-regionLabel">
          אזור <span class="CityPicker-regionRequired">*</span>
          <span v-if="errors?.region" class="CityPicker-regionError">— {{ errors.region }}</span>
        </div>
        <div v-if="modelValue.region" class="CityPicker-regionSelected">
          <span class="CityPicker-regionChip">{{ REGIONS[modelValue.region]?.label }}</span>
          <button type="button" class="CityPicker-regionBtn" @click="showRegionModal = true">
            <UiIcon name="edit_location" size="sm" />
            החלפת אזור
          </button>
        </div>
        <button v-else type="button" class="CityPicker-regionBtn" @click="showRegionModal = true">
          <UiIcon name="map" size="sm" />
          בחרו אזור
        </button>
      </div>

      <FormRegionSelectModal
        v-if="showRegionModal"
        :selected-region="modelValue.region"
        @select="onRegionSelect"
        @close="showRegionModal = false"
      />
    </template>
  </div>
</template>

<script setup>
import { CITIES, REGIONS } from '~/consts/regions.const.js'

const showRegionModal = ref(false)

function onRegionSelect(regionId) {
  update({ region: regionId })
  showRegionModal.value = false
}

defineOptions({ name: 'CityPicker' })

const props = defineProps({
  modelValue: { type: Object, default: () => ({ cityId: '', customCity: undefined, region: '' }) },
  errors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const pickerEl = ref(null)
const searchEl = ref(null)
const dropdownStyle = ref({})

const isCustom = computed(() => props.modelValue.customCity !== undefined && !props.modelValue.cityId)

const displayValue = computed(() => {
  if (props.modelValue.cityId) return CITIES[props.modelValue.cityId]?.title || ''
  if (isCustom.value && props.modelValue.customCity) return `ישוב אחר: ${props.modelValue.customCity}`
  if (isCustom.value) return 'ישוב אחר (לא ברשימה)'
  return ''
})

const allCities = computed(() => {
  const list = []
  for (const [id, city] of Object.entries(CITIES)) {
    list.push({ id, title: city.title, region: city.region })
  }
  return list.sort((a, b) => a.title.localeCompare(b.title, 'he'))
})

const filteredCities = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allCities.value
  return allCities.value.filter(c => c.title.toLowerCase().includes(q))
})


function openDropdown() {
  if (!pickerEl.value) return
  const rect = pickerEl.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 1600,
  }
  isOpen.value = true
  search.value = ''
  nextTick(() => searchEl.value?.focus())
}

function closeDropdown() {
  isOpen.value = false
}

function selectCity(city) {
  emit('update:modelValue', { cityId: city.id, customCity: undefined, region: city.region || '' })
  closeDropdown()
}

function selectCustom() {
  emit('update:modelValue', { cityId: '', customCity: '', region: '' })
  closeDropdown()
}

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<style lang="scss">
.CityPicker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &-input {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: border-color 0.15s;
    box-sizing: border-box;
    width: 100%;

    &:hover, &--open { border-color: var(--brand-dark-green); }
  }

  &-inputText {
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    color: var(--color-text);
    &--placeholder { color: var(--color-text-muted); }
  }

  &-chevron { color: var(--color-text-muted); flex-shrink: 0; }

  &-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1599;
  }

  &-dropdown {
    background: var(--color-background);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 320px;
  }

  &-search {
    padding: var(--spacing-sm) var(--spacing-sm);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-searchInput {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--color-text);
    background: var(--color-background);
    direction: rtl;
    box-sizing: border-box;
    &::placeholder { color: var(--color-text-muted); }
    &:focus { outline: none; border-color: var(--brand-dark-green); }
  }

  &-divider { height: 1px; background: var(--color-border); flex-shrink: 0; }

  &-list {
    overflow-y: auto;
    flex: 1;
  }

  &-option {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-sm);
    cursor: pointer;
    direction: rtl;
    transition: background 0.1s;

    &:hover { background: var(--light-bg); }
    &--selected { background: var(--brand-dark-green-tint-light); color: var(--brand-dark-green); font-weight: 600; }
    &--custom { font-weight: 600; color: var(--brand-dark-green); flex-shrink: 0; }
  }

  &-noResults {
    padding: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-align: center;
  }

  &-regionField {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-regionLabel {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  &-regionRequired { color: var(--color-error); margin-inline-start: 2px; }

  &-regionError {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-regionSelected {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  &-regionChip {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.75rem;
    border-radius: var(--radius-full);
    background: var(--brand-dark-green);
    border: 1.5px solid var(--brand-dark-green);
    color: #fff;
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  &-regionBtn {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px dashed var(--brand-dark-green-tint);
    border-radius: var(--radius-md);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    &:hover { background: var(--brand-dark-green-tint); border-style: solid; }
  }
}
</style>

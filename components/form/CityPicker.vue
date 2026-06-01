<template>
  <div class="CityPicker">
    <FormField label="ישוב" :error="errors?.city">
      <select
        class="FormSelect"
        :value="isCustom ? '__custom__' : modelValue.cityId"
        @change="onCityChange"
      >
        <option value="">בחרו ישוב...</option>
        <optgroup v-for="(cities, regionKey) in citiesByRegion" :key="regionKey" :label="REGIONS[regionKey]?.label">
          <option
            v-for="city in cities"
            :key="city.id"
            :value="city.id"
          >{{ city.title }}</option>
        </optgroup>
        <option value="__custom__">ישוב אחר (לא ברשימה)</option>
      </select>
    </FormField>

    <template v-if="isCustom">
      <FormField label="שם הישוב" :error="errors?.customCity">
        <input
          :value="modelValue.customCity"
          type="text"
          class="FormInput"
          placeholder="הזינו שם ישוב"
          maxlength="40"
          @input="update({ customCity: $event.target.value })"
        />
      </FormField>

      <FormField label="אזור" :error="errors?.region">
        <div class="CityPicker-regions">
          <label
            v-for="r in regionList"
            :key="r.id"
            class="CityPicker-regionOption"
            :class="{ 'CityPicker-regionOption--selected': modelValue.region === r.id }"
          >
            <input
              type="radio"
              :value="r.id"
              :checked="modelValue.region === r.id"
              @change="update({ region: r.id })"
            />
            {{ r.label }}
          </label>
        </div>
      </FormField>
    </template>
  </div>
</template>

<script setup>
import { CITIES, REGIONS } from '~/consts/regions.const.js'

defineOptions({ name: 'CityPicker' })

const props = defineProps({
  modelValue: { type: Object, default: () => ({ cityId: '', customCity: '', region: '' }) },
  errors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const isCustom = computed(() => !props.modelValue.cityId && (props.modelValue.customCity !== undefined))

const citiesByRegion = computed(() => {
  const groups = { golan: [], upper: [], center: [] }
  for (const [id, city] of Object.entries(CITIES)) {
    if (groups[city.region]) groups[city.region].push({ id, title: city.title })
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.title.localeCompare(b.title, 'he'))
  }
  return groups
})

const regionList = computed(() => Object.values(REGIONS))

function onCityChange(e) {
  const val = e.target.value
  if (val === '__custom__') {
    emit('update:modelValue', { cityId: '', customCity: '', region: '' })
  } else if (val === '') {
    emit('update:modelValue', { cityId: '', customCity: undefined, region: '' })
  } else {
    const city = CITIES[val]
    emit('update:modelValue', { cityId: val, customCity: undefined, region: city?.region || '' })
  }
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

  &-regions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-regionOption {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: border-color 0.15s, background 0.15s;

    input[type='radio'] {
      accent-color: var(--brand-dark-green);
      width: 1rem;
      height: 1rem;
      cursor: pointer;
    }

    &--selected {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
      font-weight: 600;
    }

    &:hover {
      border-color: var(--brand-dark-green);
    }
  }
}
</style>

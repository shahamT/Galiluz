<template>
  <div
    ref="mapRef"
    class="AreaFilterMap"
    :class="selectedRegionClasses"
    :data-hover-region="hoveredRegion"
  >
    <div
      v-if="svgContent"
      class="AreaFilterMap-svgContainer"
    >
      <div
        class="AreaFilterMap-svgWrap"
        v-html="svgContent"
      />
    </div>
  </div>
</template>

<script setup>
import { REGION_KEYS } from '~/consts/regions.const'

defineOptions({ name: 'AreaFilterMap' })

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

const mapRef = ref(null)
const svgContent = ref('')
const hoveredRegion = ref(null)

const selectedRegionClasses = computed(() => {
  const selected = props.modelValue ?? []
  return selected.filter((k) => REGION_KEYS.includes(k)).map((k) => `AreaFilterMap--selected-${k}`)
})

onMounted(() => {
  fetch('/imgs/areas-filter-map.svg')
    .then((res) => res.text())
    .then((html) => {
      svgContent.value = html
      nextTick(() => bindRegionHover())
    })
})

function toggleRegion(key) {
  const current = [...(props.modelValue ?? [])]
  const idx = current.indexOf(key)
  if (idx > -1) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('update:modelValue', current)
}

function bindRegionHover() {
  if (!mapRef.value) return
  REGION_KEYS.forEach((key) => {
    const regionEls = [
      mapRef.value.querySelector(`.AreaFilterMap-regionShape--${key}`),
      mapRef.value.querySelector(`.AreaFilterMap-regionTitle--${key}`),
      ...mapRef.value.querySelectorAll(`.AreaFilterMap-regionCity--${key}`),
    ].filter(Boolean)

    if (!regionEls.length) return

    const setHover = () => { hoveredRegion.value = key }
    const clearHover = (e) => {
      const target = e.relatedTarget
      if (target && regionEls.includes(target)) return
      hoveredRegion.value = null
    }

    regionEls.forEach((el) => {
      el.addEventListener('mouseenter', setHover)
      el.addEventListener('mouseleave', clearHover)
      el.addEventListener('click', () => toggleRegion(key))
      el.style.cursor = 'pointer'
    })
  })
}
</script>

<style lang="scss">
.AreaFilterMap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;

  &-svgContainer {
    width: 100%;
    font-family: var(--font-family-body);

    @media (min-width: 768px) {
      max-width: calc(420px * 615 / 696);
      max-height: 420px;
    }
  }

  &-svgWrap {
    width: 100%;
    aspect-ratio: 615 / 696;

    :deep(svg) {
      display: block;
      width: 100%;
      height: 100%;
      vertical-align: top;
    }
  }

  .AreaFilterMap-regionShape {
    filter: none;
    transition: fill 0.2s ease, filter 0.2s ease;
  }

  .AreaFilterMap-regionTitle {
    transition: fill 0.2s ease;
  }

  .AreaFilterMap-regionCity {
    transition: fill 0.2s ease;
  }

  /* Hover on non-selected: light mint (distinct from border, invite to select) */
  &[data-hover-region='center']:not(.AreaFilterMap--selected-center) {
    .AreaFilterMap-regionShape--center {
      fill: var(--brand-light-green-hover);
    }
    .AreaFilterMap-regionTitle--center {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionCity--center {
      fill: black;
    }
  }

  &[data-hover-region='golan']:not(.AreaFilterMap--selected-golan) {
    .AreaFilterMap-regionShape--golan {
      fill: var(--brand-light-green-hover);
    }
    .AreaFilterMap-regionTitle--golan {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionCity--golan {
      fill: black;
    }
  }

  &[data-hover-region='upper']:not(.AreaFilterMap--selected-upper) {
    .AreaFilterMap-regionShape--upper {
      fill: var(--brand-light-green-hover);
    }
    .AreaFilterMap-regionTitle--upper {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionCity--upper {
      fill: black;
    }
  }

  /* Hover on selected: dark green with slight brightness (click to deselect) */
  &[data-hover-region='center'].AreaFilterMap--selected-center {
    .AreaFilterMap-regionShape--center {
      fill: var(--brand-dark-green);
      filter: brightness(1.08);
    }
    .AreaFilterMap-regionTitle--center {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--center {
      fill: var(--area-filter-region-fill);
    }
  }

  &[data-hover-region='golan'].AreaFilterMap--selected-golan {
    .AreaFilterMap-regionShape--golan {
      fill: var(--brand-dark-green);
      filter: brightness(1.08);
    }
    .AreaFilterMap-regionTitle--golan {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--golan {
      fill: var(--area-filter-region-fill);
    }
  }

  &[data-hover-region='upper'].AreaFilterMap--selected-upper {
    .AreaFilterMap-regionShape--upper {
      fill: var(--brand-dark-green);
      filter: brightness(1.08);
    }
    .AreaFilterMap-regionTitle--upper {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--upper {
      fill: var(--area-filter-region-fill);
    }
  }

  /* Selected only (no hover): dark green */
  &--selected-center:not([data-hover-region='center']) {
    .AreaFilterMap-regionShape--center {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionTitle--center {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--center {
      fill: var(--area-filter-region-fill);
    }
  }

  &--selected-golan:not([data-hover-region='golan']) {
    .AreaFilterMap-regionShape--golan {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionTitle--golan {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--golan {
      fill: var(--area-filter-region-fill);
    }
  }

  &--selected-upper:not([data-hover-region='upper']) {
    .AreaFilterMap-regionShape--upper {
      fill: var(--brand-dark-green);
    }
    .AreaFilterMap-regionTitle--upper {
      fill: var(--chip-text-white);
    }
    .AreaFilterMap-regionCity--upper {
      fill: var(--area-filter-region-fill);
    }
  }
}
</style>

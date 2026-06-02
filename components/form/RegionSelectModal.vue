<template>
  <Teleport to="body">
    <div class="RegionSelectModal-overlay" @click.self="emit('close')">
      <div class="RegionSelectModal-panel">
        <div class="RegionSelectModal-header">
          <span class="RegionSelectModal-title">בחרו אזור</span>
          <button type="button" class="RegionSelectModal-close" @click="emit('close')">
            <UiIcon name="close" size="md" />
          </button>
        </div>
        <div class="RegionSelectModal-body">
          <UiAreaFilterMap :model-value="selectedAsArray" @update:model-value="onMapUpdate" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'FormRegionSelectModal' })

const props = defineProps({
  selectedRegion: { type: String, default: '' },
})
const emit = defineEmits(['select', 'close'])

const selectedAsArray = computed(() =>
  props.selectedRegion ? [props.selectedRegion] : []
)

function onMapUpdate(newRegions) {
  const added = newRegions.find(r => r !== props.selectedRegion)
  if (added) {
    emit('select', added)
    emit('close')
  }
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.RegionSelectModal {
  &-overlay {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);

    @include mobile { padding: 0; align-items: stretch; }
  }

  &-panel {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile { max-width: none; border-radius: 0; height: 100%; }
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0;
    display: flex;
    &:hover { color: var(--color-text); }
  }

  &-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>

<template>
  <div
    ref="popupRef"
    class="FilterPopup"
    @click.stop
  >
    <UiFilterPanel
      :categories="categories"
      :selected-categories-count="selectedCategoriesCount"
      :hours-filter-label="hoursFilterLabel"
      @close="emit('close')"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'FilterPopup' })

const props = defineProps({
  triggerElement: {
    type: Object,
    required: true,
  },
  categories: {
    type: Object,
    default: () => ({}),
  },
  selectedCategoriesCount: {
    type: Number,
    default: 0,
  },
  hoursFilterLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close'])

const popupRef = ref(null)

onClickOutside(
  popupRef,
  () => {
    emit('close')
  },
  {
    ignore: [props.triggerElement],
  }
)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.FilterPopup {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--spacing-sm);
  background-color: var(--light-bg);
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-lg);
  min-width: var(--popup-min-width);
  z-index: var(--z-index-modal);

  @include desktop {
    max-height: 540px;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;

    > * {
      min-height: 0;
      min-width: 0;
    }
  }
}
</style>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="WelcomeModal"
    >
      <div class="WelcomeModal-content">
        <header
          v-if="currentStep >= 1"
          class="WelcomeModal-header"
        >
          <h2 class="WelcomeModal-headerTitle">
            {{ currentStep === 1 ? WELCOME_MODAL.stepTitleRegion : WELCOME_MODAL.stepTitleCategories }}
          </h2>
          <button
            type="button"
            class="WelcomeModal-closeButton"
            aria-label="סגור"
            @click="handleDismiss"
          >
            <UiIcon name="close" size="md" />
          </button>
        </header>
        <section class="WelcomeModal-body">
          <div
            class="WelcomeModal-bodyInner"
            :class="{ 'WelcomeModal-bodyInner--step0': currentStep === 0 }"
          >
            <template v-if="currentStep === 0">
              <div class="WelcomeModal-step0Main">
                <img
                  src="/logos/galiluz-logo.svg"
                  alt="גלילוז"
                  class="WelcomeModal-logo"
                />
                <p class="WelcomeModal-introSubtitle">
                  {{ WELCOME_MODAL.introSubtitle }}
                </p>
                <p class="WelcomeModal-introLine1">
                  {{ WELCOME_MODAL.introLine1 }}
                </p>
                <p class="WelcomeModal-introLine2">
                  {{ WELCOME_MODAL.introLine2 }}
                </p>
                <button
                  type="button"
                  class="WelcomeModal-primaryButton WelcomeModal-introActionButton"
                  @click="handleStart"
                >
                  {{ WELCOME_MODAL.startButtonLabel }}
                </button>
              </div>
              <div class="WelcomeModal-step0Bottom">
                <p class="WelcomeModal-skipCaption">
                  {{ WELCOME_MODAL.skipIntroCaption }}
                </p>
                <button
                  type="button"
                  class="WelcomeModal-skipButton WelcomeModal-introActionButton"
                  @click="handleDismiss"
                >
                  {{ WELCOME_MODAL.skipIntroLabel }}
                </button>
              </div>
            </template>
            <template v-else-if="currentStep === 1">
              <p class="WelcomeModal-regionsHeading">
                {{ WELCOME_MODAL.regionsHeading }}
              </p>
              <div class="WelcomeModal-regionButtons">
                <button
                  v-for="region in WELCOME_REGION_OPTIONS"
                  :key="region.id"
                  type="button"
                  class="WelcomeModal-regionBtn"
                  :class="{ 'WelcomeModal-regionBtn--active': selectedRegions.includes(region.id) }"
                  @click="toggleRegion(region.id)"
                >
                  {{ region.label }}
                </button>
              </div>
            </template>
            <template v-else>
              <p class="WelcomeModal-categoriesHeading">
                {{ WELCOME_MODAL.categoriesHeading }}
              </p>
              <UiCategoryFilterContent
                v-if="categoriesData && Object.keys(categoriesData).length"
                :categories="categoriesData"
                :model-value="localSelectedCategories"
                @update:model-value="onCategoriesUpdate"
              />
            </template>
          </div>
        </section>
        <footer
          v-if="currentStep >= 1"
          class="WelcomeModal-footer"
        >
          <button
            type="button"
            class="WelcomeModal-skipButton"
            @click="handleDismiss"
          >
            {{ WELCOME_MODAL.skipLabel }}
          </button>
          <button
            type="button"
            class="WelcomeModal-primaryButton"
            :disabled="currentStep === 2 && !localSelectedCategories.length"
            @click="currentStep === 1 ? handleNextStep() : handleTakeMeToSchedule()"
          >
            {{ currentStep === 1 ? WELCOME_MODAL.nextStepLabel : WELCOME_MODAL.takeMeToScheduleLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import {
  WELCOME_MODAL_STORAGE_KEY,
  WELCOME_MODAL,
  WELCOME_REGION_OPTIONS,
} from '~/consts/ui.const'

defineOptions({ name: 'WelcomeModal' })

defineEmits(['close'])

const isVisible = ref(false)
const currentStep = ref(0)
const selectedRegions = ref([])
const localSelectedCategories = ref([])

const { data: categoriesData } = useCategories()
const calendarStore = useCalendarStore()
const { timeFilterStart, timeFilterEnd, timeFilterPreset } = storeToRefs(calendarStore)

onMounted(() => {
  if (import.meta.server) return
  if (import.meta.dev) {
    isVisible.value = true
    return
  }
  try {
    const stored = localStorage.getItem(WELCOME_MODAL_STORAGE_KEY)
    if (!stored) {
      isVisible.value = true
    }
  } catch {
    isVisible.value = true
  }
})

function toggleRegion(regionId) {
  const idx = selectedRegions.value.indexOf(regionId)
  if (idx > -1) {
    selectedRegions.value = selectedRegions.value.filter((id) => id !== regionId)
  } else {
    selectedRegions.value = [...selectedRegions.value, regionId]
  }
}

function handleDismiss() {
  try {
    localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, new Date().toISOString())
  } catch {
    // ignore
  }
  isVisible.value = false
}

function handleStart() {
  // TODO: Re-enable region step when ready – go to step 1 (regions) then step 2 (categories)
  currentStep.value = 2
}

function handleNextStep() {
  currentStep.value = 2
}

function handleTakeMeToSchedule() {
  calendarStore.setFiltersFromUrl(
    localSelectedCategories.value,
    timeFilterStart.value,
    timeFilterEnd.value,
    timeFilterPreset.value
  )
  handleDismiss()
}

function onCategoriesUpdate(ids) {
  localSelectedCategories.value = ids
}

watch(isVisible, (visible) => {
  if (import.meta.server) return
  document.body.style.overflow = visible ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.WelcomeModal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--modal-backdrop-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 0;

  &-content {
    position: relative;
    width: 100%;
    min-width: var(--popup-min-width);
    max-width: var(--modal-max-width);
    max-height: min(650px, calc(100vh - 2 * var(--spacing-lg)));
    border-radius: var(--radius-lg);
    padding: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--light-bg);
    margin: var(--spacing-lg);
    overflow: hidden;

    @include mobile {
      min-width: 0;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      border-radius: 0;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
  }

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-headerTitle {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  &-closeButton {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text);
    transition: opacity 0.2s ease;
    border-radius: 50%;

    &:hover {
      opacity: 0.7;
      background-color: var(--day-cell-hover-bg);
    }
  }

  &-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    text-align: center;
    direction: ltr;
    padding: var(--spacing-lg);

    @include mobile {
      flex: 1;
      min-height: 0;
      padding: var(--spacing-lg);
    }
  }

  &-bodyInner {
    direction: rtl;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    text-align: center;
    min-height: min-content;
    width: 100%;

    &--step0 {
      display: grid;
      grid-template-rows: 1fr auto;
      grid-template-columns: 1fr;
      gap: 0;
      min-height: 100%;
      align-items: start;
      justify-items: center;
    }
  }

  &-step0Main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-lg);
    text-align: center;
    width: 100%;
    max-width: 20rem;
    min-height: 0;
  }

  &-step0Bottom {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
    text-align: center;
    width: 100%;
    max-width: 20rem;
    padding-top: var(--spacing-lg);
  }

  &-logo {
    width: 100%;
    max-width: 12rem;
    height: auto;
    display: block;
    flex-shrink: 0;
    align-self: center;

    @include mobile {
      max-width: 16rem;
    }
  }

  &-introSubtitle {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;

    @include mobile {
      font-size: var(--font-size-xl);
    }
  }

  &-introLine1 {
    font-size: var(--font-size-base);
    font-weight: 400;
    color: var(--color-text);
    margin: 0;
    line-height: 1.5;

    @include mobile {
      font-size: var(--font-size-lg);
    }
  }

  &-introLine2 {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--brand-dark-green);
    margin: 0;
    line-height: 1.5;

    @include mobile {
      font-size: var(--font-size-lg);
    }
  }

  &-skipCaption {
    font-size: var(--font-size-sm);
    font-weight: 400;
    color: var(--color-text-light);
    margin: 0;
    line-height: 1.4;
  }

  &-regionsHeading {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;

    @include mobile {
      font-size: var(--font-size-lg);
    }
  }

  &-regionButtons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
    gap: var(--spacing-md);
    width: 100%;
    max-width: 20rem;
  }

  &-regionBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-md);
    width: 100%;
    min-height: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-light);
    background-color: transparent;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

    &:hover:not(.WelcomeModal-regionBtn--active) {
      color: var(--color-text);
      border-color: var(--brand-dark-green);
    }

    &--active {
      color: var(--chip-text-white);
      background-color: var(--brand-dark-green);
      border-color: var(--brand-dark-green);
    }

    @include mobile {
      padding: var(--spacing-md);
      font-size: var(--font-size-md);
    }
  }

  &-categoriesHeading {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;
    width: 100%;
    text-align: start;

    @include mobile {
      font-size: var(--font-size-lg);
    }
  }

  &-footer {
    padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md) var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;

    @include mobile {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
    }
  }

  &-skipButton {
    flex: 1;
    padding: 0 var(--spacing-md);
    height: var(--control-height);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--brand-dark-green);
    background-color: transparent;
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);

    &:hover {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
    }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }

  &-primaryButton {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-md);
    height: var(--control-height);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--chip-text-white);
    background-color: var(--brand-dark-green);
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include mobile {
      height: var(--section-header-height);
      font-size: var(--font-size-md);
    }
  }

  &-introActionButton {
    min-height: var(--control-height);
    height: var(--control-height);
    flex: none;
    box-sizing: border-box;

    @include mobile {
      min-height: var(--section-header-height);
      height: var(--section-header-height);
    }
  }
}
</style>

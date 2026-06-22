<template>
  <Teleport to="body">
    <Transition name="MainMenu">
      <div
        v-if="modelValue"
        class="MainMenu"
        @click.self="close"
      >
        <aside class="MainMenu-panel">
          <header class="MainMenu-header">
            <img
              src="/logos/galiluz-logo-rtl.svg"
              alt="גלילו״ז"
              class="MainMenu-logo"
            />
            <button
              type="button"
              class="MainMenu-closeButton"
              aria-label="סגור"
              @click="close"
            >
              <UiIcon name="close" size="md" />
            </button>
          </header>
          <nav class="MainMenu-body">
            <NuxtLink
              to="/events"
              class="MainMenu-item"
              @click="close"
            >
              <UiIcon name="event" size="md" class="MainMenu-itemIcon" />
              <span>{{ MAIN_MENU.events }}</span>
            </NuxtLink>
            <div class="MainMenu-separator" aria-hidden="true" />
            <NuxtLink
              to="/about"
              class="MainMenu-item"
              @click="close"
            >
              <UiIcon name="auto_stories" size="md" class="MainMenu-itemIcon" />
              <span>{{ MAIN_MENU.about }}</span>
            </NuxtLink>
            <template v-if="!isInstalled && (canInstall || isIOS)">
              <div class="MainMenu-separator" aria-hidden="true" />
              <button
                type="button"
                class="MainMenu-item"
                @click="onInstallClick"
              >
                <UiIcon name="add_to_home_screen" size="md" class="MainMenu-itemIcon" />
                <span>הוסף לדף הבית</span>
              </button>
            </template>
          </nav>
          <div class="MainMenu-loginSection">
            <NuxtLink to="/login" class="MainMenu-loginButton" @click="close">
              {{ MAIN_MENU.publisherLogin }}
            </NuxtLink>
            <button type="button" class="MainMenu-registerCta" @click="onPublisherRegister">
              {{ MAIN_MENU.publisherRegisterCta }}
            </button>
          </div>
          <div class="MainMenu-footer">
            <button type="button" class="MainMenu-item" @click="showFeedback = true; close()">
              <UiIcon name="rate_review" size="md" class="MainMenu-itemIcon" />
              <span>{{ MAIN_MENU.sendFeedback }}</span>
            </button>
            <div class="MainMenu-separator" aria-hidden="true" />
            <a
              :href="MAIN_MENU_CONTACT_LINK"
              target="_blank"
              rel="noopener noreferrer"
              class="MainMenu-item"
              @click="close"
            >
              <span class="MainMenu-whatsappIcon" aria-hidden="true" />
              <span>{{ MAIN_MENU.contactUs }}</span>
            </a>
            <div class="MainMenu-separator" aria-hidden="true" />
            <NuxtLink
              to="/terms-of-service"
              class="MainMenu-item"
              @click="close"
            >
              <UiIcon name="description" size="md" class="MainMenu-itemIcon" />
              <span>{{ MAIN_MENU.termsOfService }}</span>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
  <UiFeedbackModal v-if="showFeedback" @close="showFeedback = false" />
</template>

<script setup>
import { MAIN_MENU, MAIN_MENU_CONTACT_LINK } from '~/consts/ui.const'

defineOptions({ name: 'MainMenu' })

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const { canInstall, isIOS, isInstalled, showInstructions, triggerInstall } = useInstallPrompt()
const showFeedback = ref(false)

// Publisher registration CTA → the website registration page.
function onPublisherRegister() {
  navigateTo('/register')
  close()
}

function onInstallClick() {
  if (isIOS.value) {
    showInstructions.value = true
    close()
  } else {
    triggerInstall()
    close()
  }
}

watch(() => props.modelValue, (visible) => {
  if (import.meta.server) return
  document.body.style.overflow = visible ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

function close() {
  emit('update:modelValue', false)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.MainMenu {
  position: fixed;
  inset: 0;
  background-color: var(--modal-backdrop-bg);
  z-index: 1100;
  display: flex;

  &-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    width: min(320px, 85vw);
    height: 100%;
    background-color: var(--color-background);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    transition: transform 0.25s ease;

    @include mobile {
      width: min(320px, 100%);
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

  &-logo {
    height: 2.5rem;
    width: auto;
    object-fit: contain;
  }

  &-closeButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background-color: transparent;
    cursor: pointer;
    color: var(--brand-dark-green);
    transition: background-color 0.2s ease;

    &:hover,
    &:active {
      background-color: var(--light-bg);
    }
  }

  &-body {
    flex: 1;
    padding: var(--spacing-md);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-footer {
    margin-top: auto;
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
    flex-shrink: 0;
    border-top: 1px solid var(--brand-dark-green-tint);
  }

  &-whatsappIcon {
    display: inline-block;
    width: var(--icon-size-md);
    height: var(--icon-size-md);
    flex-shrink: 0;
    background-color: currentColor;
    mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    mask-size: contain;
    -webkit-mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    -webkit-mask-size: contain;
  }

  &-separator {
    height: 1px;
    background-color: var(--brand-dark-green-tint);
    flex-shrink: 0;
  }

  &-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--brand-dark-green);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover,
    &:active,
    &:visited {
      color: var(--brand-dark-green);
    }

    &:hover,
    &:active {
      background-color: var(--light-bg);
    }

    @include mobile {
      min-height: 3.5rem;
      font-size: var(--font-size-md);
      padding: 0 var(--spacing-lg);
    }
  }

  &-itemIcon {
    color: inherit;
    flex-shrink: 0;
  }

  // Publisher login/register — sits at the bottom of the menu area (above the
  // footer's full-width divider), not inside the bottom (feedback/contact) section.
  &-loginSection {
    flex-shrink: 0;
    padding: var(--spacing-md);
  }

  // Primary CTA — deliberately stands out from the ghost-style menu items.
  &-loginButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background-color: var(--brand-dark-green);
    color: #fff;
    font-size: var(--font-size-md);
    font-weight: 600;
    font-family: var(--font-family-body);
    text-decoration: none;
    cursor: pointer;
    transition: filter 0.2s ease;

    &:hover,
    &:active,
    &:visited {
      color: #fff;
    }

    &:hover,
    &:active {
      filter: brightness(0.93);
    }

    @include mobile {
      min-height: 3.5rem;
      font-size: var(--font-size-md);
    }
  }

  // Secondary text button under the CTA.
  &-registerCta {
    display: block;
    width: 100%;
    margin-top: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: none;
    background: transparent;
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    text-align: center;
    text-decoration: underline;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover,
    &:active {
      opacity: 0.75;
    }
  }
}

.MainMenu-enter-active,
.MainMenu-leave-active {
  transition: opacity 0.25s ease;

  .MainMenu-panel {
    transition: transform 0.25s ease;
  }
}

.MainMenu-enter-from {
  opacity: 0;

  .MainMenu-panel {
    transform: translateX(100%);
  }
}

.MainMenu-enter-to {
  opacity: 1;

  .MainMenu-panel {
    transform: translateX(0);
  }
}

.MainMenu-leave-from {
  opacity: 1;

  .MainMenu-panel {
    transform: translateX(0);
  }
}

.MainMenu-leave-to {
  opacity: 0;

  .MainMenu-panel {
    transform: translateX(100%);
  }
}
</style>

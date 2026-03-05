<template>
  <header class="AppHeader">
    <div class="AppHeader-container">
      <NuxtLink to="/events" class="AppHeader-side AppHeader-side--logo">
        <ClientOnly>
          <img
            src="/logos/galiluz-logo.svg"
            alt="Galiluz"
            class="AppHeader-logo"
          />
          <template #fallback>
            <span class="AppHeader-logoPlaceholder" aria-hidden="true" />
          </template>
        </ClientOnly>
      </NuxtLink>
      <div class="AppHeader-side AppHeader-side--actions">
        <a
          :href="CONTACT_WHATSAPP_LINK"
          target="_blank"
          rel="noopener noreferrer"
          class="AppHeader-whatsappButton"
          :aria-label="contactButtonAriaLabel"
        >
          <span class="AppHeader-whatsappText">{{ CONTACT_WHATSAPP_CTA }}</span>
          <span class="AppHeader-whatsappIcon" aria-hidden="true" />
        </a>
        <span class="AppHeader-separator" aria-hidden="true" />
        <button
          type="button"
          class="AppHeader-menuButton"
          aria-label="תפריט"
          @click="$emit('menu-click')"
        >
          <UiIcon name="menu" size="md" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { CONTACT_WHATSAPP_LINK, CONTACT_WHATSAPP_CTA } from '~/consts/ui.const'
import { computed } from 'vue'

defineOptions({ name: 'AppHeader' })

defineEmits(['menu-click'])

const contactButtonAriaLabel = computed(() => `${CONTACT_WHATSAPP_CTA} בוואטסאפ`)
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AppHeader {
  position: sticky;
  top: 0;
  height: var(--header-height);
  background-color: var(--color-background);
  z-index: 1000;
  box-shadow: var(--shadow-header);

  &-container {
    max-width: var(--content-max-width);
    width: 100%;
    margin: 0 auto;
    padding-inline: var(--spacing-3xl);
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: 1fr;
    align-items: center;
    gap: var(--spacing-md);

    @include mobile {
      padding-inline: 1rem;
    }
  }

  &-side {
    display: flex;
    align-items: center;
    min-width: 0;
    grid-row: 1;

    &--logo {
      justify-content: flex-start;
      grid-column: 2; // RTL: column 2 = left
      direction: ltr;
      text-decoration: none;
      color: inherit;
    }

    &--actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--spacing-sm);
      justify-content: flex-end;
      grid-column: 1; // RTL: column 1 = right
      direction: ltr;
    }
  }

  &-separator {
    width: 1px;
    height: 1.5rem;
    background-color: var(--color-border);
    flex-shrink: 0;
  }

  &-menuButton {
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

  &-logo {
    height: 2rem;
    width: auto;
    object-fit: contain;
    flex-shrink: 0;
    direction: ltr;
  }

  &-logoPlaceholder {
    display: inline-block;
    height: 2rem;
    width: 2rem;
    flex-shrink: 0;
  }

  &-whatsappButton {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background-color: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-md);
    transition: background-color 0.2s ease;
    flex-shrink: 0;
    height: var(--control-height);
    text-decoration: none;
    color: var(--brand-dark-green);

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
      padding: var(--spacing-xs) var(--spacing-md);
      gap: var(--spacing-sm);
    }
  }

  &-whatsappIcon {
    display: inline-block;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    background-color: currentColor;
    mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    mask-size: contain;
    -webkit-mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    -webkit-mask-size: contain;

    @include mobile {
      width: 16px;
      height: 16px;
    }
  }

  &-whatsappText {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: inherit;
    white-space: nowrap;
  }
}
</style>

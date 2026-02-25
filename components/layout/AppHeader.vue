<template>
  <header class="AppHeader">
    <div class="AppHeader-container">
      <div class="AppHeader-side AppHeader-side--logo">
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
      </div>
      <div class="AppHeader-side AppHeader-side--whatsapp">
        <a
          :href="CONTACT_WHATSAPP_LINK"
          target="_blank"
          rel="noopener noreferrer"
          class="AppHeader-whatsappButton"
          :aria-label="contactButtonAriaLabel"
        >
          <img src="/icons/whatsapp-icon.svg" alt="" class="AppHeader-whatsappIcon" />
          <span class="AppHeader-whatsappText">{{ CONTACT_WHATSAPP_CTA }}</span>
        </a>
      </div>
    </div>
  </header>
</template>

<script setup>
import { CONTACT_WHATSAPP_LINK, CONTACT_WHATSAPP_CTA } from '~/consts/ui.const'
import { computed } from 'vue'

defineOptions({ name: 'AppHeader' })

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
      justify-content: flex-end;
      grid-column: 1;
      direction: ltr;
    }

    &--whatsapp {
      justify-content: flex-start;
      grid-column: 2;
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
    background-color: var(--whatsapp-green);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-md);
    transition: opacity 0.2s ease;
    flex-shrink: 0;
    height: var(--control-height);
    text-decoration: none;

    &:hover {
      opacity: 0.9;
    }

    @include mobile {
      padding: var(--spacing-xs) var(--spacing-md);
      gap: var(--spacing-sm);
    }
  }

  &-whatsappIcon {
    width: 18px;
    height: 18px;
    filter: brightness(0) saturate(100%);

    @include mobile {
      width: 16px;
      height: 16px;
    }
  }

  &-whatsappText {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }
}
</style>

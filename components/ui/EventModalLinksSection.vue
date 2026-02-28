<template>
  <div class="EventModal-linksSection" :class="{ 'EventModal-linksSection--topPadding': hasTopPadding }">
    <a
      v-for="(link, index) in links"
      :key="index"
      :href="link.type === 'phone' ? `tel:${link.Url}` : link.Url"
      :target="link.type === 'phone' ? undefined : '_blank'"
      :rel="link.type === 'phone' ? undefined : 'noopener noreferrer'"
      class="EventModal-linkButton"
      @click="emit('link-click', link, index)"
    >
      <span class="EventModal-linkButtonText">{{ link.Title }}</span>
    </a>

    <!-- Contact Publisher Button -->
    <a
      v-if="showContactPublisher && whatsappLink"
      :href="whatsappLink"
      target="_blank"
      rel="noopener noreferrer"
      class="EventModal-linkButton EventModal-linkButton--whatsapp"
      @click="emit('contact-publisher')"
    >
      <img src="/icons/whatsapp-icon.svg" alt="WhatsApp" class="EventModal-whatsappIcon" />
      <span class="EventModal-linkButtonText">{{ MODAL_TEXT.contactPublisher }}</span>
    </a>
    <button
      v-else-if="showContactPublisher"
      disabled
      class="EventModal-linkButton EventModal-linkButton--whatsapp EventModal-linkButton--disabled"
    >
      <img src="/icons/whatsapp-icon.svg" alt="WhatsApp" class="EventModal-whatsappIcon" />
      <span class="EventModal-linkButtonText">{{ MODAL_TEXT.contactPublisher }}</span>
    </button>
  </div>
</template>

<script setup>
import { MODAL_TEXT } from '~/consts/ui.const'

defineOptions({ name: 'EventModalLinksSection' })

defineProps({
  links: {
    type: Array,
    default: () => [],
  },
  showContactPublisher: {
    type: Boolean,
    default: false,
  },
  whatsappLink: {
    type: String,
    default: '',
  },
  hasTopPadding: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['link-click', 'contact-publisher'])
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventModal {
  &-linksSection {
    background-color: var(--color-background);
    padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--spacing-sm);

    @include mobile {
      padding: 0 var(--spacing-md) var(--spacing-md) var(--spacing-md);
    }

    &--topPadding {
      padding-top: var(--spacing-lg);
      padding-bottom: 0;

      @include mobile {
        padding-top: var(--spacing-md);
        padding-bottom: 0;
      }
    }
  }

  &-linkButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: transparent;
    color: var(--brand-dark-green);
    border: 2px solid var(--brand-dark-green);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    width: auto;
    min-width: 0;
    cursor: pointer;

    &:hover:not(:disabled) {
      background-color: var(--brand-dark-green);
      color: var(--chip-text-white);
      border-color: var(--brand-dark-green);

      .EventModal-whatsappIcon {
        filter: brightness(0) invert(1);
      }
    }

    &--whatsapp {
      color: var(--whatsapp-green);
      border-color: var(--whatsapp-green);

      &:hover:not(:disabled) {
        background-color: var(--whatsapp-green);
        color: var(--chip-text-white);
        border-color: var(--whatsapp-green);
      }
    }

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include mobile {
      width: 100%;
    }
  }

  &-linkButtonText {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-whatsappIcon {
    width: var(--icon-size-sm);
    height: var(--icon-size-sm);
    flex-shrink: 0;
    filter: invert(59%) sepia(89%) saturate(464%) hue-rotate(94deg) brightness(95%) contrast(87%);
  }
}
</style>

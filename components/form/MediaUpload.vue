<template>
  <div class="MediaUpload">
    <div
      class="MediaUpload-dropzone"
      :class="{ 'MediaUpload-dropzone--over': isDragOver, 'MediaUpload-dropzone--full': isFull }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
      @click="!isFull && fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*,video/*"
        multiple
        class="MediaUpload-input"
        @change="onFileChange"
      />
      <UiIcon name="upload" size="md" class="MediaUpload-icon" />
      <span class="MediaUpload-text">
        <template v-if="isFull">הגעתם למקסימום (6 קבצים)</template>
        <template v-else>גררו קבצים לכאן או <strong>לחצו לבחירה</strong></template>
      </span>
      <span class="MediaUpload-sub">תמונות וסרטונים, עד 6 קבצים</span>
    </div>

    <div v-if="previews.length" class="MediaUpload-previews">
      <div
        v-for="(item, i) in previews"
        :key="item.id"
        class="MediaUpload-thumb"
      >
        <img v-if="item.isImage" :src="item.url" :alt="`קובץ ${i + 1}`" class="MediaUpload-thumbImg" />
        <div v-else class="MediaUpload-thumbVideo">
          <UiIcon name="videocam" size="md" />
        </div>
        <button
          type="button"
          class="MediaUpload-thumbRemove"
          :aria-label="`הסר קובץ ${i + 1}`"
          @click="remove(i)"
        >
          <UiIcon name="close" size="sm" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'MediaUpload' })

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const isDragOver = ref(false)
const MAX_FILES = 6

const previews = computed(() =>
  props.modelValue.map((f) => ({
    id: f.name + f.size,
    url: URL.createObjectURL(f),
    isImage: f.type.startsWith('image/'),
  }))
)

const isFull = computed(() => props.modelValue.length >= MAX_FILES)

function addFiles(files) {
  const remaining = MAX_FILES - props.modelValue.length
  const toAdd = Array.from(files).slice(0, remaining)
  emit('update:modelValue', [...props.modelValue, ...toAdd])
}

function onFileChange(e) {
  if (e.target.files?.length) addFiles(e.target.files)
  e.target.value = ''
}

function onDrop(e) {
  isDragOver.value = false
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
}

function remove(index) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.MediaUpload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xl) var(--spacing-lg);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: center;

    &:hover:not(&--full),
    &--over {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
    }

    &--full {
      cursor: default;
      opacity: 0.6;
    }
  }

  &-input {
    display: none;
  }

  &-icon {
    color: var(--color-text-muted);
    font-size: 2rem;
  }

  &-text {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  &-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  &-previews {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
    gap: var(--spacing-sm);
  }

  &-thumb {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  &-thumbImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &-thumbVideo {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    color: var(--color-text-muted);
  }

  &-thumbRemove {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--color-error);
    }
  }
}
</style>

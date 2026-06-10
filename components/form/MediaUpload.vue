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
        accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.mov,.avi,.mkv,.webm,.m4v"
        multiple
        class="MediaUpload-input"
        @change="onFileChange"
      />
      <UiIcon name="upload" size="md" class="MediaUpload-icon" />
      <span class="MediaUpload-text">
        <template v-if="isFull">הגעתם למקסימום (6 קבצים)</template>
        <template v-else>גררו קבצים לכאן או <strong>לחצו לבחירה</strong></template>
      </span>
      <span class="MediaUpload-sub">JPG, PNG, GIF, WebP, HEIC · MP4, MOV, AVI, MKV, WebM · עד 6 קבצים, עד 20MB</span>
    </div>

    <div v-if="fileErrors.length" class="MediaUpload-errors">
      <p v-for="err in fileErrors" :key="err" class="MediaUpload-error">{{ err }}</p>
    </div>

    <div v-if="existingPreviews.length || previews.length" class="MediaUpload-previews">
      <!-- Existing cloudinary media -->
      <div
        v-for="(item, i) in existingPreviews"
        :key="`existing-${i}`"
        class="MediaUpload-thumb"
      >
        <img :src="item.url" :alt="`קובץ קיים ${i + 1}`" class="MediaUpload-thumbImg" />
        <button
          type="button"
          class="MediaUpload-thumbRemove"
          :aria-label="`הסר קובץ קיים ${i + 1}`"
          @click="removeExisting(i)"
        >
          <UiIcon name="close" size="sm" />
        </button>
      </div>
      <!-- New file uploads -->
      <div
        v-for="(item, i) in previews"
        :key="item.id"
        class="MediaUpload-thumb"
      >
        <img v-if="item.isImage" :src="item.url" :alt="`קובץ ${i + 1}`" class="MediaUpload-thumbImg" />
        <div v-else class="MediaUpload-thumbVideo">
          <img v-if="videoThumbnails[item.id]" :src="videoThumbnails[item.id]" :alt="`סרטון ${i + 1}`" class="MediaUpload-thumbImg" />
          <UiIcon v-else name="videocam" size="md" />
          <div class="MediaUpload-thumbVideoBadge"><UiIcon name="play_arrow" size="sm" /></div>
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
  modelValue:    { type: Array, default: () => [] },
  existingMedia: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'update:existingMedia'])

const existingPreviews = computed(() =>
  props.existingMedia.map(m => ({ url: m.cloudinaryURL || m.url || '' })).filter(m => m.url)
)

function removeExisting(i) {
  const updated = [...props.existingMedia]
  updated.splice(i, 1)
  emit('update:existingMedia', updated)
}

const fileInput = ref(null)
const isDragOver = ref(false)
const fileErrors = ref([])
const videoThumbnails = ref({})

async function generateVideoThumbnail(file) {
  const id = file.name + file.size
  const url = URL.createObjectURL(file)
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    video.currentTime = 0.5
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve()
    }
    const timeout = setTimeout(finish, 8000)
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 180
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      videoThumbnails.value[id] = canvas.toDataURL('image/jpeg', 0.7)
      clearTimeout(timeout)
      finish()
    }, { once: true })
    video.addEventListener('error', () => { clearTimeout(timeout); finish() }, { once: true })
    video.addEventListener('abort', () => { clearTimeout(timeout); finish() }, { once: true })
  })
}

const MAX_FILES = 6
const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const ACCEPTED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/webm', 'video/m4v',
])

// Cache object URLs to avoid creating new ones on every render
const previewUrls = ref({})

watch(() => props.modelValue.map(f => f.name + f.size), (newIds) => {
  const idSet = new Set(newIds)
  // Revoke URLs for removed files
  Object.keys(previewUrls.value).forEach(key => {
    if (!idSet.has(key)) {
      URL.revokeObjectURL(previewUrls.value[key])
      delete previewUrls.value[key]
    }
  })
  // Create URLs for new files
  props.modelValue.forEach(f => {
    const key = f.name + f.size
    if (!previewUrls.value[key]) previewUrls.value[key] = URL.createObjectURL(f)
  })
}, { immediate: true })

onUnmounted(() => {
  Object.values(previewUrls.value).forEach(url => URL.revokeObjectURL(url))
})

const previews = computed(() =>
  props.modelValue.map((f) => ({
    id: f.name + f.size,
    url: previewUrls.value[f.name + f.size] || '',
    isImage: f.type.startsWith('image/'),
  }))
)

const isFull = computed(() => props.modelValue.length + props.existingMedia.length >= MAX_FILES)

function addFiles(files) {
  fileErrors.value = []
  const errors = []
  const valid = []

  for (const file of Array.from(files)) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      errors.push(`"${file.name}" — סוג קובץ לא נתמך (JPG, PNG, GIF, WebP, HEIC, MP4, MOV, AVI, MKV, WebM)`)
      continue
    }
    if (file.size > MAX_SIZE_BYTES) {
      errors.push(`"${file.name}" — הקובץ חורג מ-${MAX_SIZE_MB}MB`)
      continue
    }
    valid.push(file)
  }

  fileErrors.value = errors
  const remaining = MAX_FILES - props.modelValue.length
  const toAdd = valid.slice(0, remaining)
  emit('update:modelValue', [...props.modelValue, ...toAdd])
  toAdd.filter(f => f.type.startsWith('video/')).forEach(f => generateVideoThumbnail(f))
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

  &-errors {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-error {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-error);
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
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    color: var(--color-text-muted);
  }

  &-thumbVideoBadge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
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

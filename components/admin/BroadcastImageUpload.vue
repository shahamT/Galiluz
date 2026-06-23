<template>
  <div class="BroadcastImageUpload">
    <!-- Empty state: dropzone -->
    <div
      v-if="!modelValue && !uploading"
      class="BroadcastImageUpload-dropzone"
      :class="{ 'BroadcastImageUpload-dropzone--over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        class="BroadcastImageUpload-input"
        @change="onFileChange"
      />
      <UiIcon name="image" size="md" class="BroadcastImageUpload-icon" />
      <span class="BroadcastImageUpload-text">גררו תמונה לכאן או <strong>לחצו לבחירה</strong></span>
      <span class="BroadcastImageUpload-sub">JPG, PNG, WebP · עד 5MB · תמונה אחת</span>
    </div>

    <!-- Uploading -->
    <div v-else-if="uploading" class="BroadcastImageUpload-uploading">
      <span class="BroadcastImageUpload-spinner" aria-hidden="true" />
      <span>מעלה תמונה…</span>
    </div>

    <!-- Preview -->
    <div v-else class="BroadcastImageUpload-preview">
      <img :src="modelValue" alt="תמונת ההודעה" class="BroadcastImageUpload-previewImg" />
      <button type="button" class="BroadcastImageUpload-remove" aria-label="הסרת התמונה" @click="remove">
        <UiIcon name="close" size="sm" />
      </button>
    </div>

    <p v-if="error" class="BroadcastImageUpload-error">{{ error }}</p>
  </div>
</template>

<script setup>
defineOptions({ name: 'AdminBroadcastImageUpload' })

const props = defineProps({
  modelValue: { type: String, default: '' }, // the uploaded Cloudinary URL
})
const emit = defineEmits(['update:modelValue'])

const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

const fileInput = ref(null)
const isDragOver = ref(false)
const uploading = ref(false)
const error = ref('')

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleFile(file) {
  error.value = ''
  if (!ACCEPTED_TYPES.has(file.type)) {
    error.value = 'סוג קובץ לא נתמך (רק JPG, PNG, WebP)'
    return
  }
  if (file.size > MAX_SIZE_BYTES) {
    error.value = `התמונה חורגת מ-${MAX_SIZE_MB}MB`
    return
  }
  uploading.value = true
  try {
    const base64 = await fileToBase64(file)
    const res = await $fetch('/api/admin/broadcast-media', {
      method: 'POST',
      body: { file: base64, mimetype: file.type, filename: file.name },
    })
    if (res?.cloudinaryURL) emit('update:modelValue', res.cloudinaryURL)
    else error.value = 'העלאת התמונה נכשלה'
  } catch (err) {
    error.value = err?.data?.message || 'העלאת התמונה נכשלה'
  } finally {
    uploading.value = false
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (file) handleFile(file)
  e.target.value = ''
}

function onDrop(e) {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function remove() {
  error.value = ''
  emit('update:modelValue', '')
}
</script>

<style lang="scss">
.BroadcastImageUpload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-lg);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;

    &:hover,
    &--over {
      border-color: var(--brand-dark-green);
      background: var(--brand-dark-green-tint-light);
    }
  }

  &-input { display: none; }
  &-icon { color: var(--color-text-muted); font-size: 2rem; }
  &-text { font-size: var(--font-size-sm); color: var(--color-text); }
  &-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); }

  &-uploading {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-spinner {
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--brand-dark-green-tint);
    border-top-color: var(--brand-dark-green);
    border-radius: 50%;
    animation: BroadcastImageUpload-spin 0.7s linear infinite;
  }

  &-preview {
    position: relative;
    align-self: center;
    max-width: 16rem;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  &-previewImg { display: block; width: 100%; height: auto; }

  &-remove {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover { background: var(--color-error); }
  }

  &-error { margin: 0; font-size: var(--font-size-xs); color: var(--color-error); }
}

@keyframes BroadcastImageUpload-spin {
  to { transform: rotate(360deg); }
}
</style>

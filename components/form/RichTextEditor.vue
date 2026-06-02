<template>
  <div class="RichTextEditor" :class="{ 'RichTextEditor--focused': isFocused }">
    <div v-if="editor" class="RichTextEditor-toolbar">
      <button
        type="button"
        class="RichTextEditor-toolBtn"
        :class="{ 'RichTextEditor-toolBtn--active': editor.isActive('bold') }"
        title="מודגש"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <UiIcon name="format_bold" size="sm" />
      </button>
      <button
        type="button"
        class="RichTextEditor-toolBtn"
        :class="{ 'RichTextEditor-toolBtn--active': editor.isActive('italic') }"
        title="נטוי"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <UiIcon name="format_italic" size="sm" />
      </button>
      <div class="RichTextEditor-toolDivider" />
      <button
        type="button"
        class="RichTextEditor-toolBtn"
        :class="{ 'RichTextEditor-toolBtn--active': editor.isActive('bulletList') }"
        title="רשימה"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <UiIcon name="format_list_bulleted" size="sm" />
      </button>
      <button
        type="button"
        class="RichTextEditor-toolBtn"
        :class="{ 'RichTextEditor-toolBtn--active': editor.isActive('orderedList') }"
        title="רשימה ממוספרת"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <UiIcon name="format_list_numbered" size="sm" />
      </button>
      <div class="RichTextEditor-toolDivider" />
      <div class="RichTextEditor-emojiWrapper" ref="emojiWrapperEl">
        <button
          type="button"
          class="RichTextEditor-toolBtn"
          :class="{ 'RichTextEditor-toolBtn--active': showEmojiPicker }"
          title="אמוג'י"
          @click.stop="openEmojiPicker"
        >😀</button>
        <Teleport to="body">
          <div v-if="showEmojiPicker" class="RichTextEditor-emojiPanel" :style="emojiPanelStyle" @click.stop>
            <emoji-picker @emoji-click="onEmojiClick" />
          </div>
        </Teleport>
      </div>
    </div>

    <EditorContent :editor="editor" class="RichTextEditor-content" />

    <div class="RichTextEditor-footer">
      <span
        class="RichTextEditor-charCount"
        :class="{ 'RichTextEditor-charCount--warn': charCount < minLength && charCount > 0 }"
      >
        {{ charCount }} / {{ maxLength }}
        <span v-if="charCount < minLength && charCount > 0">(מינימום {{ minLength }} תווים)</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
if (import.meta.client) { import('emoji-picker-element') }
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'

defineOptions({ name: 'FormRichTextEditor' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  maxLength:   { type: Number, default: 3000 },
  minLength:   { type: Number, default: 70 },
})
const emit = defineEmits(['update:modelValue', 'input', 'blur'])

const isFocused = ref(false)
const showEmojiPicker = ref(false)
const emojiWrapperEl = ref(null)
const emojiPanelStyle = ref({})

function openEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value
  if (showEmojiPicker.value && emojiWrapperEl.value) {
    const rect = emojiWrapperEl.value.getBoundingClientRect()
    emojiPanelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${rect.left}px`,
      zIndex: 1500,
    }
  }
}

function onEmojiClick(e) {
  editor.value?.chain().focus().insertContent(e.detail.unicode).run()
  showEmojiPicker.value = false
}

function handleOutsideClick(e) {
  if (emojiWrapperEl.value && !emojiWrapperEl.value.contains(e.target)) {
    showEmojiPicker.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

const editor = useEditor({
  content: props.modelValue,
  editorProps: {
    transformPastedHTML(html) {
      return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    },
    handleKeyDown(view, event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault()
        const { state, dispatch } = view
        const tr = state.tr.setSelection(
          state.selection.constructor.create(state.doc, 0, state.doc.content.size)
        )
        dispatch(tr)
        return true
      }
      return false
    },
  },
  extensions: [
    StarterKit.configure({ heading: false }),
    Placeholder.configure({ placeholder: props.placeholder }),
    CharacterCount.configure({ limit: props.maxLength }),
  ],
  onUpdate({ editor: e }) {
    emit('update:modelValue', e.getHTML())
    emit('input')
  },
  onFocus() { isFocused.value = true },
  onBlur()  { isFocused.value = false; emit('blur') },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val || '', false)
  }
})

const charCount = computed(() =>
  editor.value?.storage.characterCount.characters() ?? 0
)

onUnmounted(() => editor.value?.destroy())
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.RichTextEditor {
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  transition: border-color 0.15s;
  overflow: hidden;

  &--focused { border-color: var(--brand-dark-green); }

  &-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-bottom: 1px solid var(--color-border);
    background: var(--light-bg);
    flex-wrap: wrap;
  }

  &-toolBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-light);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
    font-weight: 700;

    &:hover { background: var(--color-border); color: var(--color-text); }
    &--active { background: var(--brand-dark-green); color: #fff; }
    &--text { font-size: 0.7rem; letter-spacing: -0.03em; }
  }

  &-emojiWrapper {
    position: relative;

    @include mobile { display: none; }
  }

  &-emojiPanel {
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-md);
    overflow: hidden;

    emoji-picker {
      --border-radius: 0;
      --border-size: 0;
      height: 300px;
      width: 320px;
    }
  }

  &-toolDivider {
    width: 1px;
    height: 1.2rem;
    background: var(--color-border);
    margin: 0 var(--spacing-xs);
    flex-shrink: 0;
  }

  &-content {
    .ProseMirror {
      min-height: 8rem;
      padding: var(--spacing-sm) var(--spacing-md);
      direction: rtl;
      font-size: var(--font-size-base);
      font-family: var(--font-family-body);
      color: var(--color-text);
      line-height: 1.4;
      outline: none;

      p { margin: 0 0 0.4em; &:last-child { margin-bottom: 0; } }
      h2 { font-size: var(--font-size-xl); font-weight: 700; margin: 0 0 0.5em; }
      h3 { font-size: var(--font-size-lg); font-weight: 700; margin: 0 0 0.5em; }
      ul, ol { padding-inline-start: 1.5em; margin: 0 0 0.75em; }
      li { margin-bottom: 0.25em; }
      strong { font-weight: 700; }
      em { font-style: italic; }

      &.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        color: var(--color-text-muted);
        pointer-events: none;
        float: right;
      }
    }
  }

  &-footer {
    padding: var(--spacing-xs) var(--spacing-md);
    border-top: 1px solid var(--color-border);
    background: var(--light-bg);
  }

  &-charCount {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    &--warn { color: var(--color-error); }
  }
}

// Error state from parent FormField
.FormField--error .RichTextEditor {
  border-color: var(--color-error);
}
</style>

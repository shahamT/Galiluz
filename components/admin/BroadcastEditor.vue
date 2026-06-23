<template>
  <div class="BroadcastEditor">
    <!-- Toolbar: WhatsApp formatting + lists + emoji + personalization tags -->
    <div class="BroadcastEditor-toolbar">
      <div class="BroadcastEditor-tools">
        <button type="button" class="BroadcastEditor-toolBtn" title="מודגש (*)" @click="wrap('*')">
          <UiIcon name="format_bold" size="sm" />
        </button>
        <button type="button" class="BroadcastEditor-toolBtn" title="נטוי (_)" @click="wrap('_')">
          <UiIcon name="format_italic" size="sm" />
        </button>
        <button type="button" class="BroadcastEditor-toolBtn" title="קו חוצה (~)" @click="wrap('~')">
          <UiIcon name="format_strikethrough" size="sm" />
        </button>
        <button type="button" class="BroadcastEditor-toolBtn" title="טקסט קוד (```)" @click="wrap('```')">
          <UiIcon name="code" size="sm" />
        </button>
        <span class="BroadcastEditor-divider" />
        <button type="button" class="BroadcastEditor-toolBtn" title="רשימה" @click="applyList('bullet')">
          <UiIcon name="format_list_bulleted" size="sm" />
        </button>
        <button type="button" class="BroadcastEditor-toolBtn" title="רשימה ממוספרת" @click="applyList('number')">
          <UiIcon name="format_list_numbered" size="sm" />
        </button>
        <span class="BroadcastEditor-divider" />
        <div ref="emojiWrapperEl" class="BroadcastEditor-emojiWrapper">
          <button
            type="button"
            class="BroadcastEditor-toolBtn"
            :class="{ 'BroadcastEditor-toolBtn--active': showEmojiPicker }"
            title="אמוג'י"
            @click.stop="toggleEmojiPicker"
          >😀</button>
          <Teleport to="body">
            <div v-if="showEmojiPicker" class="BroadcastEditor-emojiPanel" :style="emojiPanelStyle" @click.stop>
              <emoji-picker @emoji-click="onEmojiClick" />
            </div>
          </Teleport>
        </div>
      </div>
      <div class="BroadcastEditor-tags">
        <span class="BroadcastEditor-tagsLabel">תגיות:</span>
        <button type="button" class="BroadcastEditor-tagBtn" @click="insertAtCursor(TAG_ACCOUNT)">שם החשבון</button>
        <button type="button" class="BroadcastEditor-tagBtn" @click="insertAtCursor(TAG_PUBLISHER)">שם המפרסם</button>
      </div>
    </div>

    <textarea
      ref="textareaEl"
      class="BroadcastEditor-textarea"
      :value="modelValue"
      :maxlength="maxLength"
      rows="7"
      placeholder="כתבו כאן את ההודעה…"
      dir="rtl"
      @input="emit('update:modelValue', $event.target.value)"
    />

    <div class="BroadcastEditor-meta">
      <span class="BroadcastEditor-count" :class="{ 'BroadcastEditor-count--over': modelValue.length > maxLength }">
        {{ modelValue.length }} / {{ maxLength }}
      </span>
    </div>

    <!-- Live preview -->
    <div class="BroadcastEditor-previewWrap">
      <span class="BroadcastEditor-previewLabel">תצוגה מקדימה</span>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="modelValue.trim()" class="BroadcastEditor-preview" dir="rtl" v-html="previewHtml" />
      <div v-else class="BroadcastEditor-previewEmpty">התצוגה המקדימה תופיע כאן…</div>
    </div>
  </div>
</template>

<script setup>
// Named import: the package's ESM build (used by Vite/Nitro) exports { format, whatsappRules }
// with NO default export — a default import throws "does not provide an export named 'default'".
// @ts-ignore — no types for this package
import { format } from '@flasd/whatsapp-formatting'
// Registers the <emoji-picker> custom element (client-only).
if (import.meta.client) { import('emoji-picker-element') }

defineOptions({ name: 'AdminBroadcastEditor' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  maxLength: { type: Number, default: 4000 },
  // First selected recipient { publisherName, accountName } — substituted for the tags in
  // the preview so it reads like the real message. null → show the tag labels as placeholders.
  sample: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

// Personalization tags — MUST match the server/gateway literals.
const TAG_ACCOUNT = '<שם החשבון>'
const TAG_PUBLISHER = '<שם המפרסם>'
const CHIP_ACCOUNT = '<span class="BroadcastEditor-tagChip">שם החשבון</span>'
const CHIP_PUBLISHER = '<span class="BroadcastEditor-tagChip">שם המפרסם</span>'
// Private-use sentinels: swap the tags for these BEFORE escaping + formatting, so a marker
// that wraps a tag (e.g. *<שם המפרסם>*) still formats as one unit, then swap in the value.
const S_ACCOUNT = String.fromCharCode(0xE000)
const S_PUBLISHER = String.fromCharCode(0xE001)
// WhatsApp list markers.
const BULLET_RE = /^[-*]\s+/
const NUMBER_RE = /^\d+\.\s+/

const textareaEl = ref(null)

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Render one line's inline content. Tags resolve to the first recipient's real name/account
// (plain text, as the recipient will see it); with no recipient selected they show as labeled
// placeholder chips. Same fallback order as the server/gateway renderer. Tags are sentinel-
// protected so WhatsApp markers wrapping a tag (e.g. *<שם המפרסם>*) still apply to the value.
function renderInline(text) {
  const protectedText = text.split(TAG_ACCOUNT).join(S_ACCOUNT).split(TAG_PUBLISHER).join(S_PUBLISHER)
  const html = format(escapeHtml(protectedText))
  const account = props.sample ? escapeHtml(props.sample.accountName || props.sample.publisherName || '') : CHIP_ACCOUNT
  const publisher = props.sample ? escapeHtml(props.sample.publisherName || props.sample.accountName || '') : CHIP_PUBLISHER
  return html.split(S_ACCOUNT).join(account).split(S_PUBLISHER).join(publisher)
}

// Block-aware preview: groups bullet (- / *) and numbered (1.) lines into real lists,
// everything else into paragraphs — mirroring how WhatsApp renders the message.
const previewHtml = computed(() => {
  const raw = props.modelValue
  if (!raw.trim()) return ''
  const lines = raw.split(/\r?\n/)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    if (BULLET_RE.test(lines[i])) {
      const items = []
      while (i < lines.length && BULLET_RE.test(lines[i])) { items.push('<li>' + renderInline(lines[i].replace(BULLET_RE, '')) + '</li>'); i++ }
      blocks.push('<ul>' + items.join('') + '</ul>')
      continue
    }
    if (NUMBER_RE.test(lines[i])) {
      const items = []
      while (i < lines.length && NUMBER_RE.test(lines[i])) { items.push('<li>' + renderInline(lines[i].replace(NUMBER_RE, '')) + '</li>'); i++ }
      blocks.push('<ol>' + items.join('') + '</ol>')
      continue
    }
    if (lines[i].trim() === '') { i++; continue }
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !BULLET_RE.test(lines[i]) && !NUMBER_RE.test(lines[i])) { para.push(renderInline(lines[i])); i++ }
    blocks.push('<p>' + para.join('<br>') + '</p>')
  }
  return blocks.join('')
})

// Wrap the current selection in a WhatsApp marker (e.g. *bold*); keep the text selected.
function wrap(marker) {
  const ta = textareaEl.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const val = props.modelValue
  const sel = val.slice(start, end)
  const next = val.slice(0, start) + marker + sel + marker + val.slice(end)
  emit('update:modelValue', next)
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(start + marker.length, end + marker.length)
  })
}

// Insert arbitrary text (tag / emoji) at the cursor.
function insertAtCursor(text) {
  const ta = textareaEl.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const val = props.modelValue
  const next = val.slice(0, start) + text + val.slice(end)
  emit('update:modelValue', next)
  nextTick(() => {
    ta.focus()
    const pos = start + text.length
    ta.setSelectionRange(pos, pos)
  })
}

// Toggle a bullet / numbered list across the selected lines.
function applyList(type) {
  const ta = textareaEl.value
  if (!ta) return
  const val = props.modelValue
  const lineStart = val.lastIndexOf('\n', ta.selectionStart - 1) + 1
  let lineEnd = val.indexOf('\n', ta.selectionEnd)
  if (lineEnd === -1) lineEnd = val.length
  const lines = val.slice(lineStart, lineEnd).split('\n')
  const re = type === 'bullet' ? BULLET_RE : NUMBER_RE
  const allMarked = lines.filter((l) => l.trim()).every((l) => re.test(l))
  let n = 0
  const out = lines
    .map((l) => {
      const stripped = l.replace(BULLET_RE, '').replace(NUMBER_RE, '')
      if (allMarked) return stripped // toggle off
      if (!stripped.trim()) return stripped // leave blank lines unmarked
      if (type === 'bullet') return '- ' + stripped
      n++
      return n + '. ' + stripped
    })
    .join('\n')
  const next = val.slice(0, lineStart) + out + val.slice(lineEnd)
  emit('update:modelValue', next)
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(lineStart, lineStart + out.length)
  })
}

// ── Emoji picker ──────────────────────────────────────────────────────────
const showEmojiPicker = ref(false)
const emojiWrapperEl = ref(null)
const emojiPanelStyle = ref({})

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value
  if (showEmojiPicker.value && emojiWrapperEl.value) {
    const rect = emojiWrapperEl.value.getBoundingClientRect()
    emojiPanelStyle.value = { position: 'fixed', top: `${rect.bottom + 6}px`, left: `${rect.left}px`, zIndex: 1500 }
  }
}

function onEmojiClick(e) {
  insertAtCursor(e.detail?.unicode || '')
  showEmojiPicker.value = false
}

function handleOutsideClick(e) {
  if (emojiWrapperEl.value && !emojiWrapperEl.value.contains(e.target)) showEmojiPicker.value = false
}
watch(showEmojiPicker, (isOpen) => {
  if (isOpen) nextTick(() => document.addEventListener('click', handleOutsideClick))
  else document.removeEventListener('click', handleOutsideClick)
})
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.BroadcastEditor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);

  &-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  &-tools { display: flex; align-items: center; gap: var(--spacing-xs); flex-wrap: wrap; }

  &-toolBtn {
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: background 0.15s, border-color 0.15s;
    &:hover { background: var(--light-bg); border-color: var(--brand-dark-green); }
    &--active { background: var(--brand-dark-green); color: #fff; border-color: var(--brand-dark-green); }
  }

  &-divider { width: 1px; height: 1.3rem; background: var(--color-border); margin: 0 2px; flex-shrink: 0; }

  &-emojiWrapper { position: relative; display: inline-flex; }
  &-emojiPanel {
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-md);
    overflow: hidden;
    emoji-picker { --border-radius: 0; --border-size: 0; height: 300px; width: 320px; }
  }

  &-tags { display: flex; align-items: center; gap: var(--spacing-xs); flex-wrap: wrap; }
  &-tagsLabel { font-size: var(--font-size-xs); color: var(--color-text-light); }
  &-tagBtn {
    padding: 2px var(--spacing-sm);
    border: 1px dashed var(--brand-dark-green);
    border-radius: var(--radius-full);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    font-family: var(--font-family-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    &:hover { background: var(--brand-dark-green-tint); }
  }

  &-textarea {
    width: 100%;
    resize: vertical;
    min-height: 8rem;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    line-height: 1.6;
    color: var(--color-text);
    &:focus { border-color: var(--brand-dark-green); outline: none; }
  }

  &-meta { display: flex; align-items: center; justify-content: flex-end; }
  &-count { flex-shrink: 0; font-size: var(--font-size-xs); color: var(--color-text-muted); }
  &-count--over { color: var(--color-error); font-weight: 700; }

  &-previewWrap {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--light-bg);
    border-radius: var(--radius-md);
  }
  &-previewLabel { font-size: var(--font-size-xs); color: var(--color-text-light); font-weight: 600; }
  &-preview {
    font-size: var(--font-size-base);
    line-height: 1.6;
    color: var(--color-text);
    word-break: break-word;
    p { margin: 0 0 0.5em; &:last-child { margin-bottom: 0; } }
    ul, ol { margin: 0 0 0.5em; padding-inline-start: 1.5em; }
    li { margin-bottom: 0.2em; }
    strong { font-weight: 700; }
    em, i { font-style: italic; }
    del, s { text-decoration: line-through; }
    code { font-family: monospace; background: rgba(0,0,0,0.06); padding: 0 4px; border-radius: 4px; }
  }
  &-previewEmpty { font-size: var(--font-size-sm); color: var(--color-text-muted); }

  &-tagChip {
    display: inline-block;
    padding: 0 6px;
    border-radius: var(--radius-full);
    background: var(--brand-dark-green-tint);
    color: var(--brand-dark-green);
    font-size: 0.85em;
    font-weight: 600;
  }
}
</style>

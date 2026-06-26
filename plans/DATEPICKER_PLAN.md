# Date & Time Picker UX Upgrade — Implementation Plan (Option B)

## Context

The current occurrence row uses `<input type="date">` for date (good on mobile) and a pair of `<select>` dropdowns for hour/minute — clunky on mobile (small targets, scroll-heavy). The goal is better UX on the phone, hard min-time enforcement on end time, and brand-matched styling. After research, **`@vuepic/vue-datepicker` (Option B)** was chosen for its polished, consistent look and hard `min-time` enforcement.

---

## Current implementation (what we're replacing)

- **Date**: `<input type="date">` — replacing with VueDatePicker date-only mode for consistent styling
- **Time**: two `<select>` dropdowns (`hours[]`, `minutes[]`) — replacing with VueDatePicker time-picker mode
- **Constraints today**: `endHoursFiltered` / `endMinutesFiltered` computed + `autoAdjustEnd()` — replaced by `:min-time` prop
- **Theming**: CSS uses `--brand-dark-green: #0B974A`, `--color-border`, `--radius-*`, `--spacing-*` from `assets/css/variables.scss`

---

## Chosen approach: `@vuepic/vue-datepicker` (v14) in time-picker mode

**What we get over the current selects:**
- Polished spinner / clock UI — consistent desktop + mobile
- Hard `min-time` on the end-time picker (library enforces it, not just advisory)
- RTL prop (`rtl: true`)
- Full CSS variable theming — map brand green to `--dp-primary-color`
- `auto-apply` closes immediately on pick

**v-model shape**: time-picker mode returns `{ hours: number, minutes: number }` — we bridge to/from `HH:mm` strings with computed getters/setters.

---

## Implementation plan

### 1. Install package

```bash
npm install @vuepic/vue-datepicker
```

### 2. `nuxt.config.ts` — two additions

```ts
css: ['~/assets/css/main.scss', '@vuepic/vue-datepicker/dist/main.css'],

build: {
  transpile: ['floating-vue', '@floating-ui/core', '@floating-ui/dom', '@vuepic/vue-datepicker'],
},
```

### 3. Brand theming in `assets/css/main.scss`

Append at the bottom:

```scss
// @vuepic/vue-datepicker brand overrides
:root {
  --dp-primary-color: var(--brand-dark-green);
  --dp-primary-text-color: #fff;
  --dp-border-color: var(--color-border);
  --dp-border-color-hover: var(--brand-dark-green);
  --dp-font-size: var(--font-size-sm);
  --dp-border-radius: var(--radius-md);
  --dp-cell-border-radius: var(--radius-sm);
}
```

### 4. `components/form/OccurrenceRow.vue`

**Script — add import at top of `<script setup>`:**
```js
import VueDatePicker from '@vuepic/vue-datepicker'
```

**Script — remove entirely:**
`hours[]`, `minutes[]`, `parseTime()`, `startH`, `startM`, `endH`, `endM`, `endHoursFiltered`, `endMinutesFiltered`, `toMins()`, `autoAdjustEnd()`, `setStart()`, `setEnd()`, `onStartHChange()`, `onStartMChange()`, `onEndHChange()`, `onEndMChange()`

**Template — replace date input** (`<input type="date" ...>`):
```html
<VueDatePicker
  v-model="local.date"
  model-type="yyyy-MM-dd"
  :enable-time-picker="false"
  :rtl="true"
  :auto-apply="true"
  :min-date="minDate"
  :disabled="frozen"
  teleport="body"
  class="OccurrenceRow-datePicker"
  @update:model-value="emit('update:modelValue', local)"
/>
```

**CSS — remove:** `.OccurrenceRow-dateInput`

**CSS — add:**
```scss
.OccurrenceRow-datePicker {
  direction: ltr;
  flex: 0 0 auto;
}
```

**Script — add computed bridges + helper:**
```js
function hhmm(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const startTimeModel = computed({
  get: () => {
    if (!local.startTime) return null
    const [h, m] = local.startTime.split(':').map(Number)
    return { hours: h, minutes: m }
  },
  set: (val) => {
    if (!val) return
    local.startTime = hhmm(val.hours, val.minutes)
    if (hasEndTime.value && local.endTime && local.endTime <= local.startTime) {
      const adj = val.hours * 60 + val.minutes + 60
      local.endTime = adj > 23 * 60 + 59 ? '23:59' : hhmm(Math.floor(adj / 60), adj % 60)
    }
    emit('update:modelValue', local)
  },
})

const endTimeModel = computed({
  get: () => {
    if (!local.endTime) return null
    const [h, m] = local.endTime.split(':').map(Number)
    return { hours: h, minutes: m }
  },
  set: (val) => {
    if (!val) return
    local.endTime = hhmm(val.hours, val.minutes)
    emit('update:modelValue', local)
  },
})

const endTimeMin = computed(() => {
  if (!local.startTime) return undefined
  const [h, m] = local.startTime.split(':').map(Number)
  return { hours: h, minutes: m }
})
```

**Script — update `onHasEndTimeChange`:**
```js
function onHasEndTimeChange() {
  if (hasEndTime.value) {
    if (!local.endTime) {
      const [sh, sm] = (local.startTime || '00:00').split(':').map(Number)
      const adj = sh * 60 + sm + 60
      local.endTime = adj > 23 * 60 + 59 ? '23:59' : hhmm(Math.floor(adj / 60), adj % 60)
    }
  } else {
    local.endTime = ''
  }
  emit('update:modelValue', local)
}
```

**Template — replace start time block** (`<div class="OccurrenceRow-timePicker">…</div>`):
```html
<VueDatePicker
  v-model="startTimeModel"
  time-picker
  :rtl="true"
  :auto-apply="true"
  :disabled="frozen"
  teleport="body"
  class="OccurrenceRow-timePicker"
/>
```

**Template — replace end time block** (`<div v-if="hasEndTime" class="OccurrenceRow-timePicker">…</div>`):
```html
<VueDatePicker
  v-if="hasEndTime"
  v-model="endTimeModel"
  time-picker
  :rtl="true"
  :auto-apply="true"
  :disabled="frozen"
  :min-time="endTimeMin"
  teleport="body"
  class="OccurrenceRow-timePicker"
/>
```

**CSS — remove:** `.OccurrenceRow-timePicker`, `.OccurrenceRow-timePicker--disabled`, `.OccurrenceRow-timeSelect`, `.OccurrenceRow-timeSep`

**CSS — add:**
```scss
.OccurrenceRow-timePicker {
  direction: ltr;
  flex: 0 0 auto;
}
```

**Nothing else changes** — `EventFormModal.vue`, `normalizeTime`, `getTimeInIsraelFromIso`, all server code stays as-is. The `HH:mm` storage format is identical.

---

## Verification

1. Tap date field → calendar popup opens; past dates blocked by `min-date`; pick sets `local.date` to `"YYYY-MM-DD"`
2. Tap start time → spinner opens; pick 14:00 — `local.startTime` becomes `"14:00"`
3. End time picker has `min-time="{ hours: 14, minutes: 0 }"` — can't select earlier (hard enforcement)
4. Change start to 16:00 while end is 15:00 → end auto-bumps to 17:00
5. Toggle "סיום" ON → end time picker appears, defaulted to start+1h
6. Toggle "סיום" OFF → end time picker hidden, `local.endTime` cleared from payload
7. All-day toggle hides both time pickers (date picker stays visible)
8. Save event → date and times round-trip correctly through `normalizeTime` / `getTimeInIsraelFromIso`
9. `npm test` — all green

<template>
  <!-- TODO: add OTP auth guard before enabling for public use -->
  <LayoutAppShell>
    <LayoutContentCard>
      <article class="AddEventPage">
        <header class="AddEventPage-hero">
          <img src="/imgs/default-event-bg.webp" alt="" class="AddEventPage-heroImage" />
          <div class="AddEventPage-heroOverlay" aria-hidden="true" />
          <h1 class="AddEventPage-heroTitle">פרסום אירוע חדש</h1>
        </header>

        <form class="AddEventPage-form" novalidate @submit.prevent="onSubmit">

          <!-- 1. פרטי האירוע -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">פרטי האירוע</h2>

            <FormField label="שם האירוע" required :error="errors.title" hint="6–80 תווים">
              <input
                v-model="form.title"
                type="text"
                class="FormInput"
                placeholder="לדוגמה: ערב מוזיקה אקוסטית בפאב השכונה"
                maxlength="80"
                @input="clearError('title')"
              />
            </FormField>

            <FormField label="תיאור קצר" :error="errors.shortDescription" hint="משפט-שניים שמתארים את האירוע בקצרה (עד 200 תווים)">
              <input
                v-model="form.shortDescription"
                type="text"
                class="FormInput"
                placeholder="לדוגמה: ערב מוזיקה אקוסטית עם אמנים מקומיים בפאב הקהילתי"
                maxlength="200"
                @input="clearError('shortDescription')"
              />
            </FormField>

            <FormField label="תיאור מלא" required :error="errors.description">
              <textarea
                v-model="form.description"
                class="FormTextarea AddEventPage-descTextarea"
                placeholder="תארו את האירוע, מה יקרה שם, למי מתאים..."
                maxlength="3000"
                @input="clearError('description')"
              />
              <div class="AddEventPage-charCount" :class="{ 'AddEventPage-charCount--warn': form.description.length < 70 }">
                {{ form.description.length }} / 3000
                <span v-if="form.description.length < 70 && form.description.length > 0">
                  (מינימום 70 תווים)
                </span>
              </div>
            </FormField>
          </section>

          <!-- 2. מועד האירוע -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">מועד האירוע</h2>
            <p class="AddEventPage-sectionHint">ניתן להוסיף מספר מועדים לאותו אירוע.</p>

            <div class="AddEventPage-occurrences">
              <FormOccurrenceRow
                v-for="(occ, i) in form.occurrences"
                :key="occ._key"
                v-model="form.occurrences[i]"
                :is-first="i === 0"
                :errors="occurrenceErrors[i] || {}"
                @remove="removeOccurrence(i)"
              />
            </div>

            <button type="button" class="AddEventPage-addBtn" @click="addOccurrence">
              <UiIcon name="add" size="sm" />
              הוספת מועד נוסף
            </button>
          </section>

          <!-- 3. קטגוריה -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">קטגוריה</h2>
            <FormField label="קטגוריה ראשית" required :error="errors.mainCategory">
              <FormCategoryPicker
                v-model="form.mainCategory"
                @update:model-value="clearError('mainCategory')"
              />
            </FormField>
          </section>

          <!-- 4. מיקום -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">מיקום</h2>

            <FormField label="שם המקום" hint="שם הוונו, עסק, מרחב ציבורי">
              <input
                v-model="form.locationName"
                type="text"
                class="FormInput"
                placeholder="לדוגמה: הפילוסופ, מרכז קהילתי, מגרש הכדורגל"
                maxlength="40"
              />
            </FormField>

            <FormCityPicker
              v-model="form.city"
              :errors="{ city: errors.city, customCity: errors.customCity, region: errors.region }"
            />

            <FormField label="כתובת" hint="רחוב ומספר">
              <input
                v-model="form.addressLine1"
                type="text"
                class="FormInput"
                placeholder="לדוגמה: רוז'נסקי 29"
                maxlength="100"
              />
            </FormField>

            <FormField label="הוראות הגעה" hint="כניסה, ניווט, סימני דרך">
              <input
                v-model="form.locationNotes"
                type="text"
                class="FormInput"
                placeholder="לדוגמה: הכניסה מהדלת האחורית, מול הבית הצהוב"
                maxlength="100"
              />
            </FormField>

            <div class="AddEventPage-navLinks">
              <FormField label="קישור Waze">
                <input
                  v-model="form.wazeLink"
                  type="url"
                  class="FormInput"
                  placeholder="https://waze.com/ul/..."
                />
              </FormField>
              <FormField label="קישור Google Maps">
                <input
                  v-model="form.gmapsLink"
                  type="url"
                  class="FormInput"
                  placeholder="https://maps.app.goo.gl/..."
                />
              </FormField>
            </div>
          </section>

          <!-- 5. מחיר -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">מחיר</h2>

            <label class="AddEventPage-toggle">
              <input v-model="form.isFree" type="checkbox" @change="onFreeToggle" />
              <span class="AddEventPage-toggleTrack" />
              <span>כניסה חופשית</span>
            </label>

            <FormField v-if="!form.isFree" label="מחיר (₪)" :error="errors.price">
              <div class="AddEventPage-priceRow">
                <input
                  v-model.number="form.price"
                  type="number"
                  class="FormInput AddEventPage-priceInput"
                  placeholder="0"
                  min="0"
                  step="1"
                  @input="clearError('price')"
                />
                <span class="AddEventPage-priceCurrency">₪</span>
              </div>
            </FormField>
          </section>

          <!-- 6. קישורים ואנשי קשר -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">קישורים ואנשי קשר <span class="AddEventPage-optional">(אופציונלי)</span></h2>
            <p class="AddEventPage-sectionHint">כרטיסים, דף אירוע, טלפון ליצירת קשר ועוד.</p>

            <div v-if="form.links.length" class="AddEventPage-links">
              <FormLinkRow
                v-for="(link, i) in form.links"
                :key="link._key"
                v-model="form.links[i]"
                @remove="removeLink(i)"
              />
            </div>

            <button
              v-if="form.links.length < 5"
              type="button"
              class="AddEventPage-addBtn"
              @click="addLink"
            >
              <UiIcon name="add" size="sm" />
              הוספת קישור
            </button>
          </section>

          <!-- 7. מדיה -->
          <section class="AddEventPage-section">
            <h2 class="AddEventPage-sectionTitle">תמונות וסרטונים <span class="AddEventPage-optional">(אופציונלי)</span></h2>
            <FormMediaUpload v-model="form.media" />
          </section>

          <!-- Submit -->
          <div class="AddEventPage-submit">
            <p v-if="hasErrors" class="AddEventPage-submitError">
              יש לתקן את השגיאות המסומנות לפני שליחה.
            </p>
            <button
              type="submit"
              class="AddEventPage-submitBtn"
              :disabled="isSubmitting"
            >
              <span v-if="isSubmitting" class="AddEventPage-submitSpinner" />
              <template v-else>פרסם אירוע ✓</template>
            </button>
          </div>

        </form>

        <!-- Success state -->
        <div v-if="submitted" class="AddEventPage-success">
          <UiIcon name="check_circle" size="md" />
          <h2>האירוע נשלח לבדיקה!</h2>
          <p>נבדוק את הפרטים ונאשר בהקדם.</p>
          <button type="button" class="AddEventPage-submitBtn" @click="resetForm">
            פרסם אירוע נוסף
          </button>
        </div>
      </article>
    </LayoutContentCard>
  </LayoutAppShell>
</template>

<script setup>
defineOptions({ name: 'AddEventPage' })

useHead({ title: 'פרסום אירוע | גלילו"ז' })

// --- Form state ---

let _key = 0
const nextKey = () => ++_key

function freshOccurrence() {
  return { _key: nextKey(), date: '', hasTime: false, startTime: '', endTime: '' }
}

function freshLink() {
  return { _key: nextKey(), type: 'link', label: '', url: '' }
}

const form = reactive({
  title: '',
  shortDescription: '',
  description: '',
  occurrences: [freshOccurrence()],
  mainCategory: '',
  locationName: '',
  city: { cityId: '', customCity: undefined, region: '' },
  addressLine1: '',
  locationNotes: '',
  wazeLink: '',
  gmapsLink: '',
  isFree: false,
  price: null,
  links: [],
  media: [],
})

const errors = reactive({})
const occurrenceErrors = reactive({})
const isSubmitting = ref(false)
const submitted = ref(false)
const hasErrors = computed(() => Object.values(errors).some(Boolean))

// --- Occurrence helpers ---

function addOccurrence() {
  form.occurrences.push(freshOccurrence())
}

function removeOccurrence(i) {
  form.occurrences.splice(i, 1)
}

// --- Link helpers ---

function addLink() {
  form.links.push(freshLink())
}

function removeLink(i) {
  form.links.splice(i, 1)
}

// --- Price ---

function onFreeToggle() {
  if (form.isFree) form.price = null
  clearError('price')
}

// --- Validation ---

function clearError(key) {
  delete errors[key]
}

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  Object.keys(occurrenceErrors).forEach((k) => delete occurrenceErrors[k])
  let ok = true

  if (!form.title.trim() || form.title.trim().length < 6) {
    errors.title = 'שם האירוע חייב להכיל לפחות 6 תווים'
    ok = false
  } else if (form.title.length > 80) {
    errors.title = 'שם האירוע ארוך מדי (מקסימום 80 תווים)'
    ok = false
  }

  if (!form.description.trim() || form.description.trim().length < 70) {
    errors.description = 'התיאור חייב להכיל לפחות 70 תווים'
    ok = false
  }

  form.occurrences.forEach((occ, i) => {
    if (!occ.date) {
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'יש לבחור תאריך' }
      ok = false
    }
    if (occ.hasTime && !occ.startTime) {
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), startTime: 'יש להזין שעת התחלה' }
      ok = false
    }
  })

  if (!form.mainCategory) {
    errors.mainCategory = 'יש לבחור קטגוריה'
    ok = false
  }

  if (!form.isFree && form.price !== null && form.price !== '' && Number(form.price) < 0) {
    errors.price = 'המחיר לא יכול להיות שלילי'
    ok = false
  }

  return ok
}

// --- Submit (mock — no API call yet) ---

async function onSubmit() {
  if (!validate()) {
    nextTick(() => {
      const firstError = document.querySelector('.FormField--error')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return
  }

  isSubmitting.value = true
  // TODO: actual API submission after OTP auth is implemented
  await new Promise((r) => setTimeout(r, 800))
  console.log('[add-event] form submitted (mock):', toRaw(form))
  isSubmitting.value = false
  submitted.value = true
}

function resetForm() {
  submitted.value = false
  form.title = ''
  form.shortDescription = ''
  form.description = ''
  form.occurrences = [freshOccurrence()]
  form.mainCategory = ''
  form.locationName = ''
  form.city = { cityId: '', customCity: undefined, region: '' }
  form.addressLine1 = ''
  form.locationNotes = ''
  form.wazeLink = ''
  form.gmapsLink = ''
  form.isFree = false
  form.price = null
  form.links = []
  form.media = []
  Object.keys(errors).forEach((k) => delete errors[k])
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AddEventPage {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;

  &-hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-height: 12rem;
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: var(--spacing-2xl);
  }

  &-heroImage {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &-heroOverlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, var(--brand-dark-green));
    pointer-events: none;
  }

  &-heroTitle {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-2xl);
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--color-background);
    text-shadow: var(--text-shadow-overlay);

    @include mobile {
      font-size: var(--font-size-2xl);
      padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
    }
  }

  &-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xl);
  }

  &-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-2xl);
    border-bottom: 1px solid var(--color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &-sectionTitle {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-sectionHint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  &-optional {
    font-weight: 400;
    font-size: var(--font-size-base);
    color: var(--color-text-muted);
  }

  &-descTextarea {
    min-height: 8rem;
  }

  &-charCount {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-align: left;

    &--warn {
      color: var(--color-error);
    }
  }

  &-occurrences,
  &-links {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-addBtn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    color: var(--brand-dark-green);
    background: var(--brand-dark-green-tint-light);
    border: 1.5px dashed var(--brand-dark-green-tint);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    align-self: flex-start;

    &:hover {
      background: var(--brand-dark-green-tint);
      border-style: solid;
    }
  }

  &-navLinks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);

    @include mobile {
      grid-template-columns: 1fr;
    }
  }

  &-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    user-select: none;
    font-size: var(--font-size-base);
    font-weight: 500;
    width: fit-content;

    input[type='checkbox'] {
      display: none;

      &:checked + .AddEventPage-toggleTrack {
        background: var(--brand-dark-green);

        &::after {
          transform: translateX(-1.25rem);
        }
      }
    }
  }

  &-toggleTrack {
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    background: var(--color-border);
    border-radius: var(--radius-full);
    flex-shrink: 0;
    transition: background 0.2s;

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 1rem;
      height: 1rem;
      background: #fff;
      border-radius: 50%;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s;
    }
  }

  &-priceRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    max-width: 10rem;
  }

  &-priceInput {
    text-align: center;
  }

  &-priceCurrency {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
    flex-shrink: 0;
  }

  &-submit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-md);
  }

  &-submitError {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
  }

  &-submitBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm-lg) var(--spacing-2xl);
    font-size: var(--font-size-lg);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    min-width: 12rem;
    transition: opacity 0.15s;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.9;
    }
  }

  &-submitSpinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  &-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-3xl) var(--spacing-xl);
    text-align: center;

    .UiIcon {
      font-size: 3rem;
      color: var(--brand-dark-green);
    }

    h2 {
      margin: 0;
      font-size: var(--font-size-2xl);
      color: var(--brand-dark-green);
    }

    p {
      margin: 0;
      color: var(--color-text-light);
    }
  }
}
</style>

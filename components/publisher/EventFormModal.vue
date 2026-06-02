<template>
  <Teleport to="body">
    <div class="EventFormModal-backdrop">
      <div class="EventFormModal-panel">
        <header class="EventFormModal-header">
          <h2 class="EventFormModal-title">אירוע חדש</h2>
          <button type="button" class="EventFormModal-close" @click="emit('close')">
            <UiIcon name="close" size="md" />
          </button>
        </header>

        <div ref="bodyEl" class="EventFormModal-body">
          <form id="eventForm" class="AddEventPage-form" novalidate @submit.prevent="onSubmit">

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
                  @blur="validateField('title')"
                />
              </FormField>

              <FormField label="תיאור קצר" required :error="errors.shortDescription" hint="משפט-שניים שמתארים את האירוע בקצרה (עד 150 תווים)">
                <input
                  v-model="form.shortDescription"
                  type="text"
                  class="FormInput"
                  placeholder="לדוגמה: ערב מוזיקה אקוסטית עם אמנים מקומיים בפאב הקהילתי"
                  maxlength="150"
                  @input="clearError('shortDescription')"
                  @blur="validateField('shortDescription')"
                />
              </FormField>

              <FormField label="תיאור מלא" required :error="errors.description">
                <FormRichTextEditor
                  v-model="form.description"
                  placeholder="תארו את האירוע, מה יקרה שם, למי מתאים..."
                  :max-length="3000"
                  :min-length="70"
                  @input="clearError('description')"
                  @blur="validateField('description')"
                />
              </FormField>

              <div class="AddEventPage-priceField">
                <span class="AddEventPage-priceLabel">מחיר כניסה</span>
                <div class="AddEventPage-priceRow">
                  <input
                    :value="form.price ?? ''"
                    type="number"
                    class="FormInput AddEventPage-priceInput"
                    placeholder="0 (כניסה חופשית)"
                    min="0"
                    step="1"
                    @input="form.price = $event.target.value === '' ? null : Number($event.target.value); clearError('price')"
                    @blur="onPriceBlur"
                  />
                  <span class="AddEventPage-priceCurrency">₪</span>
                </div>
                <span v-if="errors.price" class="AddEventPage-priceError">{{ errors.price }}</span>
              </div>
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

              <div v-if="form.occurrences.length > 1" class="AddEventPage-multiDay">
                <label class="AddEventPage-toggle">
                  <input v-model="form.multiDayEvent" type="checkbox" />
                  <span class="AddEventPage-toggleTrack" />
                  <span>אירוע רב יומי</span>
                </label>
                <p class="AddEventPage-multiDayHint">
                  האם האירוע שלכם הוא אירוע רב יומי שנמשך מספר ימים (כמו יריד או פסטיבל)?<br />
                  הגדרה זו קובעת איך יחושבו הסטטיסטיקות של האירוע שלכם.
                </p>
                <div class="AddEventPage-multiDayHint">לדוגמה:</div>
                <ul class="AddEventPage-multiDayExamples">
                  <li><strong>אירוע רב-יומי:</strong> יריד של מספר ימים, פסטיבל</li>
                  <li><strong>אירועים חד-יומיים:</strong> ערב סרט פעם בשבוע, ג'אם קבוע וכו'</li>
                </ul>
              </div>
            </section>

            <!-- 3. קטגוריה -->
            <section class="AddEventPage-section">
              <h2 class="AddEventPage-sectionTitle">קטגוריה</h2>

              <!-- Main category -->
              <div class="AddEventPage-categoryField">
                <div class="AddEventPage-categoryLabel">
                  קטגוריה ראשית <span class="AddEventPage-required">*</span>
                </div>
                <div v-if="form.mainCategory" class="AddEventPage-categoryChips">
                  <UiCategoryPill
                    :category="EVENT_CATEGORIES[form.mainCategory]"
                    :category-id="form.mainCategory"
                    :is-selected="true"
                  />
                </div>
                <button type="button" class="AddEventPage-categoryBtn" @click="openMainPicker">
                  <UiIcon name="category" size="sm" />
                  {{ form.mainCategory ? 'החלפת קטגוריה' : 'בחרו קטגוריה' }}
                </button>
                <span v-if="errors.mainCategory" class="AddEventPage-categoryError">{{ errors.mainCategory }}</span>
              </div>

              <!-- Other categories -->
              <div class="AddEventPage-categoryField">
                <div class="AddEventPage-categoryLabel">קטגוריות נוספות</div>
                <div v-if="form.categories.length" class="AddEventPage-categoryChips">
                  <div
                    v-for="catId in form.categories"
                    :key="catId"
                    class="AddEventPage-categoryChipWrapper"
                  >
                    <UiCategoryPill
                      :category="EVENT_CATEGORIES[catId]"
                      :category-id="catId"
                      :is-selected="true"
                    />
                    <button type="button" class="AddEventPage-categoryRemove" @click="removeOtherCategory(catId)">
                      <UiIcon name="close" size="sm" />
                    </button>
                  </div>
                </div>
                <button
                  v-if="form.categories.length < 3"
                  type="button"
                  class="AddEventPage-categoryBtn"
                  @click="openOtherPicker"
                >
                  <UiIcon name="add" size="sm" />
                  הוספת קטגוריה
                </button>
              </div>
            </section>

            <!-- Category dropdowns -->
            <FormCategorySelectDropdown
              v-if="showMainPicker"
              :selected-id="form.mainCategory"
              @select="onMainCategorySelect"
              @close="showMainPicker = false"
            />
            <FormCategorySelectDropdown
              v-if="showOtherPicker"
              :exclude-ids="excludedForOther"
              @select="onOtherCategorySelect"
              @close="showOtherPicker = false"
            />

            <!-- 4. מיקום -->
            <section class="AddEventPage-section">
              <h2 class="AddEventPage-sectionTitle">מיקום</h2>
              <p class="AddEventPage-sectionHint">יש להזין לפחות אחד מן השדות — שם המקום / כתובת. אין חובה למלא את שניהם.</p>

              <FormField label="שם המקום" hint="שם המתחם שבו האירוע יתקיים">
                <input
                  v-model="form.locationName"
                  type="text"
                  class="FormInput"
                  placeholder="לדוגמה: הפילוסופ, מרכז קהילתי, מגרש הכדורגל"
                  maxlength="40"
                />
              </FormField>

              <FormField label="כתובת" hint="רחוב ומספר">
                <input
                  v-model="form.addressLine1"
                  type="text"
                  class="FormInput"
                  placeholder="לדוגמה: רוז'נסקי 29"
                  maxlength="100"
                />
              </FormField>

              <FormCityPicker
                v-model="form.city"
                :errors="{ city: errors.city, customCity: errors.customCity, region: errors.region }"
              />

              <FormField label="הוראות הגעה (אופציונלי)" hint="כניסה, ניווט, סימני דרך">
                <input
                  v-model="form.locationNotes"
                  type="text"
                  class="FormInput"
                  placeholder="לדוגמה: הכניסה מהדלת האחורית, מול הבית הצהוב"
                  maxlength="100"
                />
              </FormField>

              <div class="AddEventPage-navAuto">
                <label class="AddEventPage-toggle">
                  <input v-model="form.autoNav" type="checkbox" />
                  <span class="AddEventPage-toggleTrack" />
                  <span>ניווט למיקום - אוטומטי</span>
                </label>
                <p class="AddEventPage-sectionHint">קישורים לניווט לאירוע יווצרו אוטומטית בהסתמך על הפרטים שציינת למעלה</p>
              </div>

              <div v-if="!form.autoNav" class="AddEventPage-navLinks">
                <FormField label="קישור Waze">
                  <input v-model="form.wazeLink" type="url" class="FormInput" placeholder="https://waze.com/ul/..." />
                </FormField>
                <FormField label="קישור Google Maps">
                  <input v-model="form.gmapsLink" type="url" class="FormInput" placeholder="https://maps.app.goo.gl/..." />
                </FormField>
              </div>
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
                  :errors="linkErrors[i] || {}"
                  @blur="validateLink(i)"
                  @remove="removeLink(i)"
                />
              </div>

              <button v-if="form.links.length < 5" type="button" class="AddEventPage-addBtn" @click="addLink">
                <UiIcon name="add" size="sm" />
                הוספת קישור
              </button>
            </section>

            <!-- 7. מדיה -->
            <section class="AddEventPage-section">
              <h2 class="AddEventPage-sectionTitle">תמונות וסרטונים <span class="AddEventPage-optional">(אופציונלי)</span></h2>
              <FormMediaUpload v-model="form.media" />
            </section>

          </form>

          <!-- Success state -->
          <div v-if="submitted" class="AddEventPage-success">
            <UiIcon name="check_circle" size="md" />
            <h2>האירוע נשלח לבדיקה!</h2>
            <p>נבדוק את הפרטים ונאשר בהקדם.</p>
          </div>
        </div>

        <!-- Fixed footer -->
        <div class="EventFormModal-footer">
          <button
            v-if="!submitted"
            type="submit"
            form="eventForm"
            class="EventFormModal-footerBtn"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="AddEventPage-submitSpinner" />
            <template v-else>פרסם אירוע ✓</template>
          </button>
          <button v-else type="button" class="EventFormModal-footerBtn" @click="resetForm">
            פרסם אירוע נוסף
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { EVENT_CATEGORIES } from '~/consts/events.const.js'

defineOptions({ name: 'PublisherEventFormModal' })
defineProps({ mode: { type: String, default: 'add' } })
const emit = defineEmits(['close', 'submitted'])

const bodyEl = ref(null)

onMounted(() => { document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = '' })

// --- Form state ---
let _key = 0
const nextKey = () => ++_key

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function freshOccurrence() {
  return { _key: nextKey(), date: todayLocal(), hasTime: true, startTime: '08:00', endTime: '09:00' }
}
function freshLink() {
  return { _key: nextKey(), type: 'link', label: '', url: '' }
}

const form = reactive({
  title: '',
  shortDescription: '',
  description: '',
  occurrences: [freshOccurrence()],
  multiDayEvent: true,
  mainCategory: '',
  categories: [],
  locationName: '',
  city: { cityId: '', customCity: undefined, region: '' },
  addressLine1: '',
  locationNotes: '',
  autoNav: true,
  wazeLink: '',
  gmapsLink: '',
  price: null,
  links: [],
  media: [],
})

const errors = reactive({})
const occurrenceErrors = reactive({})
const isSubmitting = ref(false)
const submitted = ref(false)
const hasErrors = computed(() => Object.values(errors).some(Boolean))

const isFormValid = computed(() => {
  if (form.title.trim() && (form.title.trim().length < 2 || form.title.length > 80)) return false
  if (!form.shortDescription.trim() || form.shortDescription.trim().length > 150) return false
  if (getTextLength(form.description) < 40 || /<a\b/i.test(form.description)) return false
  const _today = todayLocal()
  for (const occ of form.occurrences) {
    if (!occ.date || occ.date < _today) return false
    if (occ.hasTime && !occ.startTime) return false
  }
  if (!form.mainCategory) return false
  if (!form.city.cityId && form.city.customCity === undefined) return false
  if (form.city.customCity !== undefined && !form.city.customCity?.trim()) return false
  if (form.city.customCity !== undefined && !form.city.region) return false
  if (form.price !== null && form.price !== '' && Number(form.price) < 0) return false
  return true
})

function validateField(key) {
  delete errors[key]
  switch (key) {
    case 'title':
      if (form.title.trim() && form.title.trim().length < 2)
        errors.title = 'שם האירוע חייב להכיל לפחות 2 תווים'
      else if (form.title.length > 80)
        errors.title = 'שם האירוע ארוך מדי (מקסימום 80 תווים)'
      break
    case 'shortDescription':
      if (!form.shortDescription.trim())
        errors.shortDescription = 'יש להוסיף תיאור קצר'
      else if (form.shortDescription.trim().length > 150)
        errors.shortDescription = 'התיאור הקצר לא יכול לעלות על 150 תווים'
      break
    case 'description':
      if (getTextLength(form.description) < 40)
        errors.description = 'התיאור חייב להכיל לפחות 40 תווים'
      else if (/<a\b/i.test(form.description))
        errors.description = 'התיאור לא יכול להכיל קישורים'
      break
    case 'price':
      if (form.price !== null && form.price !== '' && Number(form.price) < 0)
        errors.price = 'המחיר לא יכול להיות שלילי'
      break
  }
}

watch(() => form.occurrences, () => {
  Object.keys(occurrenceErrors).forEach(k => delete occurrenceErrors[k])
  const today = todayLocal()
  form.occurrences.forEach((occ, i) => {
    if (!occ.date)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'יש לבחור תאריך' }
    else if (occ.date < today)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'התאריך לא יכול להיות בעבר' }
    if (occ.hasTime && !occ.startTime)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), startTime: 'יש להזין שעת התחלה' }
  })
}, { deep: true })

watch(() => form.occurrences.length, (len, prevLen) => {
  if (len <= 1) {
    form.multiDayEvent = true
  } else if (prevLen <= 1) {
    form.multiDayEvent = false
  }
})

// --- Category picker ---
const showMainPicker = ref(false)
const showOtherPicker = ref(false)

const excludedForOther = computed(() =>
  [form.mainCategory, ...form.categories].filter(Boolean)
)

function openMainPicker() {
  showOtherPicker.value = false
  showMainPicker.value = true
}

function openOtherPicker() {
  showMainPicker.value = false
  showOtherPicker.value = true
}

function onMainCategorySelect(id) {
  form.mainCategory = id
  clearError('mainCategory')
  showMainPicker.value = false
}

function onOtherCategorySelect(id) {
  if (!form.categories.includes(id)) form.categories.push(id)
  showOtherPicker.value = false
}

function removeOtherCategory(id) {
  form.categories = form.categories.filter(c => c !== id)
}

// --- Helpers ---
function addOccurrence() { form.occurrences.push(freshOccurrence()) }
function removeOccurrence(i) { form.occurrences.splice(i, 1) }
function addLink() { form.links.push(freshLink()) }
function removeLink(i) { form.links.splice(i, 1) }

function validateLink(i) {
  const link = form.links[i]
  if (!link) return
  const e = {}
  if (!link.label.trim() || link.label.trim().length < 3) e.label = 'יש להוסיף תווית (לפחות 3 תווים)'
  if (!link.url.trim()) {
    e.url = 'יש להוסיף קישור או מספר טלפון'
  } else if (link.type === 'phone' && !isValidPhone(link.url)) {
    e.url = 'מספר טלפון לא תקין'
  } else if (link.type === 'link' && !isValidUrl(link.url)) {
    e.url = 'כתובת URL לא תקינה (יש להתחיל עם https://)'
  }
  linkErrors[i] = e
}
function clearError(key) { delete errors[key] }
function onPriceBlur() {
  if (form.price === 0) form.price = null
  validateField('price')
}

function getTextLength(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length
}

function isValidPhone(val) {
  return (val.replace(/\D/g, '').length >= 7)
}
function isValidUrl(val) {
  return /^https?:\/\/.+/.test(val.trim())
}
function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length
}

// --- Validation ---
const linkErrors = reactive([])

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  Object.keys(occurrenceErrors).forEach((k) => delete occurrenceErrors[k])
  linkErrors.splice(0)
  let ok = true

  if (form.title.trim() && form.title.trim().length < 2) {
    errors.title = 'שם האירוע חייב להכיל לפחות 2 תווים'; ok = false
  } else if (form.title.length > 80) {
    errors.title = 'שם האירוע ארוך מדי (מקסימום 80 תווים)'; ok = false
  }

  if (!form.shortDescription.trim()) {
    errors.shortDescription = 'יש להוסיף תיאור קצר'; ok = false
  } else if (form.shortDescription.trim().length > 150) {
    errors.shortDescription = 'התיאור הקצר לא יכול לעלות על 150 תווים'; ok = false
  }

  if (getTextLength(form.description) < 40) {
    errors.description = 'התיאור חייב להכיל לפחות 40 תווים'; ok = false
  } else if (/<a\b/i.test(form.description)) {
    errors.description = 'התיאור לא יכול להכיל קישורים'; ok = false
  }

  const today = todayLocal()
  form.occurrences.forEach((occ, i) => {
    if (!occ.date) {
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'יש לבחור תאריך' }; ok = false
    } else if (occ.date < today) {
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'התאריך לא יכול להיות בעבר' }; ok = false
    }
    if (occ.hasTime && !occ.startTime) {
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), startTime: 'יש להזין שעת התחלה' }; ok = false
    }
  })

  if (!form.mainCategory) { errors.mainCategory = 'יש לבחור קטגוריה'; ok = false }

  if (!form.city.cityId && form.city.customCity === undefined) {
    errors.city = 'יש לבחור ישוב'; ok = false
  } else if (form.city.customCity !== undefined && !form.city.customCity?.trim()) {
    errors.customCity = 'יש להזין שם ישוב'; ok = false
  }

  if (form.city.customCity !== undefined && !form.city.region) {
    errors.region = 'יש לבחור אזור'; ok = false
  }

  if (form.price !== null && form.price !== '' && Number(form.price) < 0) {
    errors.price = 'המחיר לא יכול להיות שלילי'; ok = false
  }

  form.links.forEach((link, i) => {
    const e = {}
    if (!link.label.trim() || link.label.trim().length < 3) e.label = 'יש להוסיף תווית (לפחות 3 תווים)'
    if (!link.url.trim()) {
      e.url = 'יש להוסיף קישור או מספר טלפון'
    } else if (link.type === 'phone' && !isValidPhone(link.url)) {
      e.url = 'מספר טלפון לא תקין'
    } else if (link.type === 'link' && !isValidUrl(link.url)) {
      e.url = 'כתובת URL לא תקינה (יש להתחיל עם https://)'
    }
    if (Object.keys(e).length) { linkErrors[i] = e; ok = false }
    else linkErrors[i] = {}
  })

  return ok
}

// --- Submit ---
async function onSubmit() {
  if (!validate()) {
    nextTick(() => {
      const firstError = bodyEl.value?.querySelector('.FormField--error')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return
  }
  isSubmitting.value = true
  await new Promise((r) => setTimeout(r, 800))
  console.log('[EventFormModal] form submitted (mock):', toRaw(form))
  isSubmitting.value = false
  submitted.value = true
  emit('submitted')
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
  form.autoNav = true
  form.wazeLink = ''
  form.gmapsLink = ''

  form.price = null
  form.links = []
  form.media = []
  form.categories = []
  form.multiDayEvent = true
  Object.keys(errors).forEach((k) => delete errors[k])
}
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.EventFormModal {
  &-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: var(--modal-backdrop-bg, rgba(0,0,0,0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);

    @include mobile {
      padding: 0;
      align-items: stretch;
    }
  }

  &-panel {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include mobile {
      max-width: none;
      max-height: none;
      height: 100%;
      border-radius: 0;
    }
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  &-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--brand-dark-green);
  }

  &-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover { color: var(--color-text); }
  }

  &-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl) var(--spacing-lg);
    direction: rtl;
  }

  &-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-md) var(--spacing-lg);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--color-border);
    background: var(--color-background);
    box-shadow: var(--shadow-top);
  }

  &-footerError {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
    text-align: center;
  }

  &-footerBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--section-header-height);
    font-size: var(--font-size-base);
    font-family: var(--font-family-body);
    font-weight: 700;
    color: #fff;
    background: var(--brand-dark-green);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }
  }
}

// Form styles (kept from AddEventPage)
.AddEventPage {
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
    &:last-child { border-bottom: none; }
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

  &-descTextarea { min-height: 8rem; }

  &-charCount {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-align: left;
    &--warn { color: var(--color-error); }
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
    &:hover { background: var(--brand-dark-green-tint); border-style: solid; }
  }

  &-navLinks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
    @include mobile { grid-template-columns: 1fr; }
  }

  &-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    user-select: none;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    width: fit-content;

    input[type='checkbox'] {
      display: none;
      &:checked + .AddEventPage-toggleTrack {
        background: var(--brand-dark-green);
        &::after { transform: translateX(-1.25rem); }
      }
    }
  }

  &-categoryField {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-categoryLabel {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  &-required {
    color: var(--color-error);
    margin-inline-start: 2px;
  }

  &-categoryRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  &-categoryBtn {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: var(--spacing-xs);
    height: var(--control-height);
    padding: 0 var(--spacing-md);
    border: 1.5px dashed var(--brand-dark-green-tint);
    border-radius: var(--radius-md);
    background: var(--brand-dark-green-tint-light);
    color: var(--brand-dark-green);
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-family-body);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    &:hover { background: var(--brand-dark-green-tint); border-style: solid; }
  }

  &-categoryChips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);

    .CategoryPill {
      cursor: default;
      pointer-events: none;
      &:hover { transform: none; opacity: 1; }
    }
  }

  &-categoryChipWrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  &-categoryRemove {
    position: absolute;
    inset-inline-start: -6px;
    top: -6px;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--color-text);
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 0.65rem;
    line-height: 1;
    z-index: 1;
    &:hover { background: var(--color-error); }
  }

  &-categoryError {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-multiDay {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--light-bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  &-multiDayHint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.6;
  }

  &-multiDayExamples {
    margin: 0;
    padding-inline-start: var(--spacing-lg);
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: 1.8;
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

  &-priceInline {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    flex-wrap: wrap;
  }

  &-priceField {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-priceLabel {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  &-priceError {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  &-priceRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    max-width: 16rem;
  }

  &-priceInput { text-align: center; }

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
    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.9; }
  }

  &-submitSpinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: addEventSpin 0.7s linear infinite;
  }

  @keyframes addEventSpin {
    to { transform: rotate(360deg); }
  }

  &-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-3xl) var(--spacing-xl);
    text-align: center;

    .UiIcon { font-size: 3rem; color: var(--brand-dark-green); }
    h2 { margin: 0; font-size: var(--font-size-2xl); color: var(--brand-dark-green); }
    p { margin: 0; color: var(--color-text-light); }
  }
}
</style>

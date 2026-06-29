<template>
  <Teleport to="body">
    <div class="EventFormModal-backdrop">
      <div class="EventFormModal-panel">
        <header class="EventFormModal-header">
          <h2 class="EventFormModal-title">{{ props.mode === 'edit' ? 'עדכון אירוע' : 'אירוע חדש' }}</h2>
          <button type="button" class="EventFormModal-close" @click="emit('close')">
            <UiIcon name="close" size="md" />
          </button>
        </header>

        <div ref="bodyEl" class="EventFormModal-body">
          <form id="eventForm" class="AddEventPage-form" :class="{ 'AddEventPage-form--busy': formBusy }" novalidate @submit.prevent="onSubmit">

            <!-- 0. פרסום אירוע עבור (admin only) -->
            <section v-if="onBehalfPublishers.length" class="EventFormModal-onBehalf">
              <h2 class="AddEventPage-sectionTitle">פרסום אירוע עבור</h2>
              <div class="EventFormModal-onBehalfRadios">
                <label class="EventFormModal-onBehalfRadio">
                  <input v-model="onBehalfMode" type="radio" value="self" />
                  <span>בשמי (גלילו"ז)</span>
                </label>
                <div class="EventFormModal-onBehalfOption">
                  <label class="EventFormModal-onBehalfRadio">
                    <input v-model="onBehalfMode" type="radio" value="existing" />
                    <span>בשם מפרסם אחר</span>
                  </label>
                  <div v-if="onBehalfMode === 'existing'" class="EventFormModal-onBehalfField">
                    <AdminPublisherSelect
                      v-model="onBehalfPublisher"
                      :publishers="onBehalfPublishers"
                      :has-error="!!errors.onBehalfPublisher"
                    />
                    <p v-if="errors.onBehalfPublisher" class="EventFormModal-onBehalfError">{{ errors.onBehalfPublisher }}</p>
                  </div>
                </div>
                <div class="EventFormModal-onBehalfOption">
                  <label class="EventFormModal-onBehalfRadio">
                    <input v-model="onBehalfMode" type="radio" value="new" />
                    <span>מפרסם חדש</span>
                  </label>
                  <div v-if="onBehalfMode === 'new'" class="EventFormModal-onBehalfField">
                    <input
                      v-model="onBehalfPhone"
                      type="tel"
                      class="FormInput"
                      placeholder="מספר טלפון (לדוגמה: 0501234567)"
                      dir="ltr"
                      @input="clearError('onBehalfPhone')"
                    />
                    <p v-if="errors.onBehalfPhone" class="EventFormModal-onBehalfError">{{ errors.onBehalfPhone }}</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- AI generation (add mode only) -->
            <PublisherEventFormAiGenerate
              v-if="props.mode !== 'edit'"
              v-model:text="aiText"
              v-model:expanded="aiExpanded"
              :loading="aiLoading"
              :error="aiError"
              @generate="onAiGenerate"
            />

            <!-- 1. פרטי האירוע -->
            <section ref="detailsSectionEl" class="AddEventPage-section">
              <h2 class="AddEventPage-sectionTitle">פרטי האירוע</h2>

              <FormField label="שם האירוע" required :error="errors.title" hint="2–80 תווים">
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

              <div class="AddEventPage-priceField" :class="{ 'AddEventPage-priceField--error': errors.price }">
                <span class="AddEventPage-priceLabel">מחיר כניסה</span>

                <label class="AddEventPage-toggle">
                  <input v-model="form.isFree" type="checkbox" @change="onFreeToggle" />
                  <span class="AddEventPage-toggleTrack" />
                  <span>כניסה חופשית</span>
                </label>

                <div v-if="!form.isFree" class="AddEventPage-priceRow">
                  <input
                    :value="form.price ?? ''"
                    type="number"
                    class="FormInput AddEventPage-priceInput"
                    placeholder="מחיר"
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

              <div class="AddEventPage-occurrences" :class="{ 'FormField--error': errors.occurrences }">
                <FormOccurrenceRow
                  v-for="(occ, i) in form.occurrences"
                  :key="occ._key"
                  v-model="form.occurrences[i]"
                  :is-first="i === 0"
                  :frozen="!!occ._frozen"
                  :errors="occurrenceErrors[i] || {}"
                  @remove="removeOccurrence(i)"
                  @duplicate="duplicateOccurrence(i)"
                />
                <span v-if="errors.occurrences" class="FormField-error" role="alert">{{ errors.occurrences }}</span>
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
              <div class="AddEventPage-categoryField" :class="{ 'FormField--error': errors.mainCategory }">
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

              <div :class="{ 'FormField--error': errors.locationRequired }" class="AddEventPage-locationGroup">
                <p v-if="errors.locationRequired" class="AddEventPage-locationError">{{ errors.locationRequired }}</p>

                <FormField label="שם המקום" hint="שם המתחם שבו האירוע יתקיים">
                  <input
                    v-model="form.locationName"
                    type="text"
                    class="FormInput"
                    placeholder="לדוגמה: הפאב של דני, מרכז קהילתי, מגרש הכדורגל"
                    maxlength="40"
                    @input="clearError('locationRequired')"
                  />
                </FormField>

                <FormField label="כתובת" hint="רחוב ומספר">
                  <input
                    v-model="form.addressLine1"
                    type="text"
                    class="FormInput"
                    placeholder="לדוגמה: רוז'נסקי 29"
                    maxlength="100"
                    @input="clearError('locationRequired')"
                  />
                </FormField>
              </div>

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
                <FormField label="קישור Waze" :error="errors.wazeLink">
                  <input
                    v-model="form.wazeLink"
                    type="url"
                    class="FormInput"
                    placeholder="https://waze.com/ul/..."
                    @input="clearError('wazeLink')"
                    @blur="validateField('wazeLink')"
                  />
                </FormField>
                <FormField label="קישור Google Maps" :error="errors.gmapsLink">
                  <input
                    v-model="form.gmapsLink"
                    type="url"
                    class="FormInput"
                    placeholder="https://maps.app.goo.gl/..."
                    @input="clearError('gmapsLink')"
                    @blur="validateField('gmapsLink')"
                  />
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
                  @blur="(field) => validateLink(i, field)"
                  @remove="removeLink(i)"
                />
              </div>

              <button v-if="form.links.length < 5" type="button" class="AddEventPage-addBtn" @click="addLink">
                <UiIcon name="add" size="sm" />
                הוספת קישור
              </button>

              <!-- WhatsApp contact-number visibility -->
              <div class="AddEventPage-contactPhone">
                <label class="AddEventPage-toggle">
                  <input v-model="form.showContactPhone" type="checkbox" />
                  <span class="AddEventPage-toggleTrack" />
                  <span>הצג מספר ליצירת קשר בוואטסאפ</span>
                </label>

                <div v-if="form.showContactPhone" class="AddEventPage-contactPhoneOptions">
                  <label class="EventFormModal-onBehalfRadio">
                    <input v-model="form.contactSource" type="radio" value="own" @change="clearError('customPhone')" />
                    <span>הצג את המספר שלי</span>
                  </label>
                  <label class="EventFormModal-onBehalfRadio">
                    <input v-model="form.contactSource" type="radio" value="custom" />
                    <span>הצג מספר אחר</span>
                  </label>

                  <FormField v-if="form.contactSource === 'custom'" label="מספר ליצירת קשר" required :error="errors.customPhone">
                    <input
                      v-model="form.customPhone"
                      type="tel"
                      class="FormInput"
                      dir="ltr"
                      inputmode="tel"
                      placeholder="05X-XXXXXXX"
                      @input="clearError('customPhone')"
                      @blur="validateCustomPhone"
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <!-- 7. מדיה -->
            <section class="AddEventPage-section">
              <h2 class="AddEventPage-sectionTitle">תמונות וסרטונים <span class="AddEventPage-optional">(אופציונלי)</span></h2>
              <FormMediaUpload v-model="form.media" v-model:existing-media="existingMedia" />
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
          <p v-if="submitError" class="EventFormModal-footerError">{{ submitError }}</p>
          <button
            v-if="!submitted"
            type="submit"
            form="eventForm"
            class="EventFormModal-footerBtn"
            :disabled="formBusy"
          >
            <span v-if="isSubmitting" class="AddEventPage-submitSpinner" />
            <template v-else>{{ props.mode === 'edit' ? 'שמור אירוע ✓' : 'יצירת אירוע ✓' }}</template>
          </button>
          <button v-else type="button" class="EventFormModal-footerBtn" @click="resetForm">
            פרסם אירוע נוסף
          </button>
          <!-- Draft-only: delete is offered here for drafts; active events are deleted from the details page. -->
          <button
            v-if="props.mode === 'edit' && props.initialData && props.initialData.isActive === false"
            type="button"
            class="EventFormModal-footerDelete"
            :disabled="formBusy"
            @click="emit('delete')"
          >
            <UiIcon name="delete" size="sm" />
            מחיקת טיוטה
          </button>
        </div>

        <UiConfirmDialog
          :open="showAiOverrideConfirm"
          title="החלפת פרטי הטופס"
          message="פעולה זו תחליף את כל הפרטים שכבר מולאו בטופס. להמשיך?"
          confirm-label="כן, החליפו"
          cancel-label="ביטול"
          @confirm="confirmAiOverride"
          @cancel="showAiOverrideConfirm = false"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { EVENT_CATEGORIES } from '~/consts/events.const.js'
import { CITIES } from '~/consts/regions.const.js'

const FormRichTextEditor = defineAsyncComponent(() => import('~/components/form/RichTextEditor.vue'))

defineOptions({ name: 'PublisherEventFormModal' })
const props = defineProps({
  mode:               { type: String, default: 'add' },
  initialData:        { type: Object, default: null },
  draftKey:           { type: String, default: null },
  onBehalfPublishers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'submitted', 'delete'])

const bodyEl = ref(null)
const detailsSectionEl = ref(null)

const existingMedia = ref([])

const { saveDraft, loadDraft, clearDraft } = useEventDraft()

onMounted(() => {
  document.body.style.overflow = 'hidden'
  if (props.draftKey) {
    const draft = loadDraft(props.draftKey)
    if (draft) { restoreFromDraft(draft); return }
  }
  if (props.initialData) initFromData(props.initialData)
})
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
  isFree: false,
  links: [],
  media: [],
  showContactPhone: true,   // show a WhatsApp contact button on the event
  contactSource: 'own',     // 'own' = the publisher's number | 'custom'
  customPhone: '',          // when contactSource === 'custom'
})

const errors = reactive({})
const occurrenceErrors = reactive({})
const isSubmitting = ref(false)
const submitted = ref(false)
const submitError = ref('')
const hasErrors = computed(() => Object.values(errors).some(Boolean))

const onBehalfMode = ref('self')
const onBehalfPublisher = ref(null)
const onBehalfPhone = ref('')
watch(onBehalfMode, () => {
  onBehalfPublisher.value = null
  onBehalfPhone.value = ''
  errors.onBehalfPublisher = ''
  errors.onBehalfPhone = ''
})


function validateField(key) {
  errors[key] = ''
  switch (key) {
    case 'title':
      if (!form.title.trim())
        errors.title = 'יש להוסיף שם לאירוע'
      else if (form.title.trim().length < 2)
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
      if (getTextLength(form.description) < 70)
        errors.description = 'התיאור חייב להכיל לפחות 70 תווים'
      else if (/<a\b/i.test(form.description))
        errors.description = 'התיאור לא יכול להכיל קישורים'
      break
    case 'wazeLink':
      if (!form.autoNav && form.wazeLink.trim() && !isNavServiceLink(form.wazeLink, 'waze'))
        errors.wazeLink = 'הקישור צריך להיות קישור שיתוף של Waze'
      break
    case 'gmapsLink':
      if (!form.autoNav && form.gmapsLink.trim() && !isNavServiceLink(form.gmapsLink, 'gmaps'))
        errors.gmapsLink = 'הקישור צריך להיות קישור שיתוף של Google Maps'
      break
    case 'price':
      if (!form.isFree && (form.price === null || form.price === ''))
        errors.price = 'יש להזין מחיר'
      else if (form.price !== null && form.price !== '' && Number(form.price) < 0)
        errors.price = 'המחיר לא יכול להיות שלילי'
      else if (!form.isFree && form.price !== null && form.price !== '' && Number(form.price) === 0)
        errors.price = 'לאירוע ללא תשלום הפעילו את "כניסה חופשית"'
      break
  }
}

watch(() => form.occurrences, () => {
  Object.keys(occurrenceErrors).forEach(k => { occurrenceErrors[k] = {} })
  const today = todayLocal()
  form.occurrences.forEach((occ, i) => {
    if (occ._frozen) return
    if (!occ.date)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'יש לבחור תאריך' }
    else if (occ.date < today)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), date: 'התאריך לא יכול להיות בעבר' }
    if (occ.hasTime && !occ.startTime)
      occurrenceErrors[i] = { ...(occurrenceErrors[i] || {}), startTime: 'יש להזין שעת התחלה' }
  })
}, { deep: true })

// When main category changes, remove it from additional categories to prevent duplication
watch(() => form.mainCategory, (newMain) => {
  form.categories = form.categories.filter(c => c !== newMain)
})

// Clear city/region validation errors as soon as the picker selection becomes valid
// (CityPicker only emits update:modelValue, so there's no per-field @input to hook clearError to).
watch(() => form.city, (c) => {
  if (c?.cityId) { errors.city = ''; errors.customCity = ''; errors.region = ''; return } // listed city → custom fields gone
  if (c?.customCity !== undefined) errors.city = '' // entered "custom" mode
  if (c?.customCity?.trim()) errors.customCity = ''
  if (c?.region) errors.region = ''
}, { deep: true })

// Auto-default the multi-day flag as the user changes the number of occurrences:
// a lone occurrence is trivially "multi-day"; growing from one to many defaults the
// flag OFF (treat as separate single-day events) until the user opts in. Suppressed
// during programmatic prefill (edit / draft restore) so a saved `true` survives the
// occurrences being loaded — see initFromData / restoreFromDraft.
let suppressMultiDayDefault = false
watch(() => form.occurrences.length, (len, prevLen) => {
  if (suppressMultiDayDefault) return
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
function addOccurrence() {
  form.occurrences.push(freshOccurrence())
  clearError('occurrences')
}
function removeOccurrence(i) {
  form.occurrences.splice(i, 1)
  if (form.occurrences.length === 0) errors.occurrences = 'יש להוסיף לפחות מועד אחד לאירוע'
}
function duplicateOccurrence(i) {
  const src = form.occurrences[i]
  const date = src._frozen ? todayLocal() : src.date
  form.occurrences.splice(i + 1, 0, { _key: nextKey(), date, hasTime: src.hasTime, startTime: src.startTime, endTime: src.endTime })
}
function addLink() { form.links.push(freshLink()) }
function removeLink(i) { form.links.splice(i, 1) }

function validateLink(i, field) {
  const link = form.links[i]
  if (!link) return
  const e = { ...(linkErrors[i] || {}) }
  if (field === 'label' || !field) {
    delete e.label
    if (!link.label.trim() || link.label.trim().length < 3) e.label = 'יש להוסיף תווית (לפחות 3 תווים)'
  }
  if (field === 'url' || !field) {
    delete e.url
    if (!link.url.trim()) {
      e.url = 'יש להוסיף קישור או מספר טלפון'
    } else if (link.type === 'phone' && !isValidPhone(link.url)) {
      e.url = 'מספר טלפון לא תקין'
    } else if (link.type === 'link' && !isValidUrl(link.url)) {
      e.url = 'כתובת URL לא תקינה'
    }
  }
  linkErrors.splice(i, 1, e)
}
function clearError(key) { errors[key] = '' }

// Custom contact number is required + must be a valid Israeli number, only when shown + custom.
function validateCustomPhone() {
  if (form.showContactPhone && form.contactSource === 'custom') {
    errors.customPhone = !form.customPhone.trim()
      ? 'יש להזין מספר טלפון'
      : (normalizeIsraeliPhone(form.customPhone) ? '' : 'מספר טלפון לא תקין')
  } else {
    errors.customPhone = ''
  }
}
function onPriceBlur() {
  const n = parseFloat(form.price)
  form.price = isNaN(n) ? null : n
  validateField('price')
}

// Free entry toggle: hide + clear the price input so no leftover value is saved
function onFreeToggle() {
  if (form.isFree) {
    form.price = null
    clearError('price')
  }
}

function normalizeTime(t) {
  if (!t) return ''
  if (/^\d{2}:\d{2}$/.test(String(t))) return t
  return getTimeInIsraelFromIso(t) || ''
}

function initFromData(data) {
  form.title = data.title || ''
  form.shortDescription = data.shortDescription || ''
  form.description = data.fullDescription || ''
  const today = todayLocal()
  // Suppress the occurrences-length auto-default while loading saved occurrences;
  // otherwise the watcher would reset multiDayEvent to false right after we restore it.
  suppressMultiDayDefault = true
  // When editing an event with no occurrences (e.g. a crawler draft where no date
  // was extracted), show NO date rows rather than the new-event today-08:00 default —
  // that fake default looks complete and gets published as-is. Empty list = the user
  // sees no occurrence and validation forces them to add one (mirrors applyAiResult).
  // The today-08:00 default is reserved for creating a brand-new event only.
  form.occurrences = data.occurrences?.length
    ? data.occurrences.map(o => ({ _key: nextKey(), date: o.date || '', hasTime: o.hasTime !== false, startTime: normalizeTime(o.startTime), endTime: normalizeTime(o.endTime), _frozen: (o.date || '') < today }))
    : []
  form.multiDayEvent = data.multiDayEvent !== false
  nextTick(() => { suppressMultiDayDefault = false })
  form.mainCategory = data.mainCategory || ''
  form.categories = (data.categories || []).filter(c => c !== data.mainCategory)
  form.locationName = data.location?.locationName || ''
  form.addressLine1 = data.location?.addressLine1 || ''
  form.locationNotes = data.location?.locationNotes || ''
  const hasCustomLinks = !!(data.location?.wazeNavLink || data.location?.gmapsNavLink)
  form.autoNav = !hasCustomLinks
  form.wazeLink = data.location?.wazeNavLink || ''
  form.gmapsLink = data.location?.gmapsNavLink || ''
  form.isFree = data.price === 0
  form.price = data.price === 0 ? null : (data.price ?? null)
  form.links = (data.urls || []).filter(Boolean).map(u => ({ _key: nextKey(), type: u.type || 'link', label: u.Title || '', url: u.Url || '' }))
  form.showContactPhone = data.showContactPhone !== false
  form.contactSource = data.customContactPhone ? 'custom' : 'own'
  form.customPhone = data.customContactPhone || ''
  existingMedia.value = data.media || []
  const cityKey = data.location?.city || ''
  const cityType = data.location?.cityType
  if (cityType === 'custom') {
    form.city = { cityId: '', customCity: cityKey, region: data.location?.region || '' }
  } else if (cityKey && CITIES[cityKey]) {
    // Listed city (explicit cityType === 'listed', or legacy doc with a known city ID)
    form.city = { cityId: cityKey, customCity: undefined, region: CITIES[cityKey].region }
  } else if (cityKey) {
    // Legacy custom city without cityType — restore the region from the stored event data
    form.city = { cityId: '', customCity: cityKey, region: data.location?.region || '' }
  }
}

function restoreFromDraft(draft) {
  const d = draft.form
  form.title = d.title || ''
  form.shortDescription = d.shortDescription || ''
  form.description = d.description || ''
  suppressMultiDayDefault = true
  // Restored draft keeps whatever occurrences it held; if it had none, show no rows
  // (never the today-08:00 default) so validation forces an explicit occurrence.
  form.occurrences = (d.occurrences?.length ? d.occurrences : []).map(o => ({ ...o, _key: nextKey() }))
  form.multiDayEvent = d.multiDayEvent !== false
  nextTick(() => { suppressMultiDayDefault = false })
  form.mainCategory = d.mainCategory || ''
  form.categories = d.categories || []
  form.locationName = d.locationName || ''
  form.city = d.city || { cityId: '', customCity: undefined, region: '' }
  form.addressLine1 = d.addressLine1 || ''
  form.locationNotes = d.locationNotes || ''
  form.autoNav = d.autoNav !== false
  form.wazeLink = d.wazeLink || ''
  form.gmapsLink = d.gmapsLink || ''
  form.price = d.price ?? null
  form.isFree = d.isFree ?? (d.price === 0)
  if (form.isFree) form.price = null
  form.links = (d.links || []).map(l => ({ ...l, _key: nextKey() }))
  form.showContactPhone = d.showContactPhone !== false
  form.contactSource = d.contactSource || (d.customPhone ? 'custom' : 'own')
  form.customPhone = d.customPhone || ''
  form.media = []
  existingMedia.value = draft.existingMedia || []
}

function getTextLength(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length
}

function isValidPhone(val) {
  return (val.replace(/\D/g, '').length >= 7)
}
function normalizeUrl(val) {
  const trimmed = val.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isValidUrl(val) {
  return /^(https?:\/\/)?[\w.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(val.trim())
}

// Loose service-recognition for navigation links — checks the host signature only,
// so parameter/path format changes keep working. Extend with one regex per new format.
// Waze:   waze.com/ul?…, www.waze.com/ul/h…, ul.waze.com/ul/h…, waze.com/live-map/…
// GMaps:  maps.app.goo.gl/…, goo.gl/maps/… (legacy), google.<tld>/maps/…, maps.google.<tld>/…
const NAV_LINK_PATTERNS = {
  waze: [
    /(\/\/|\.)waze\.com([/?#]|$)/i,
  ],
  gmaps: [
    /(\/\/|\.)maps\.app\.goo\.gl([/?#]|$)/i,
    /(\/\/|\.)goo\.gl\/maps/i,
    /(\/\/|\.)google\.[a-z.]{2,10}\/maps/i,
    /(\/\/|\.)maps\.google\.[a-z.]{2,10}([/?#]|$)/i,
  ],
}

function isNavServiceLink(val, service) {
  const normalized = normalizeUrl(val)
  return NAV_LINK_PATTERNS[service].some((re) => re.test(normalized))
}

function normalizeIsraeliPhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length === 12) return digits
  if (digits.startsWith('05') && digits.length === 10) return '972' + digits.slice(1)
  if (digits.startsWith('5') && digits.length === 9) return '972' + digits
  return null
}

// --- Validation ---
const linkErrors = reactive([])

function validate() {
  Object.keys(errors).forEach((k) => { errors[k] = '' })
  Object.keys(occurrenceErrors).forEach((k) => { occurrenceErrors[k] = {} })
  linkErrors.splice(0)
  let ok = true

  if (props.onBehalfPublishers.length) {
    if (onBehalfMode.value === 'existing' && !onBehalfPublisher.value) {
      errors.onBehalfPublisher = 'יש לבחור מפרסם'; ok = false
    }
    if (onBehalfMode.value === 'new' && !normalizeIsraeliPhone(onBehalfPhone.value)) {
      errors.onBehalfPhone = 'מספר טלפון לא תקין'; ok = false
    }
  }

  if (!form.title.trim()) {
    errors.title = 'יש להוסיף שם לאירוע'; ok = false
  } else if (form.title.trim().length < 2) {
    errors.title = 'שם האירוע חייב להכיל לפחות 2 תווים'; ok = false
  } else if (form.title.length > 80) {
    errors.title = 'שם האירוע ארוך מדי (מקסימום 80 תווים)'; ok = false
  }

  if (!form.shortDescription.trim()) {
    errors.shortDescription = 'יש להוסיף תיאור קצר'; ok = false
  } else if (form.shortDescription.trim().length > 150) {
    errors.shortDescription = 'התיאור הקצר לא יכול לעלות על 150 תווים'; ok = false
  }

  if (getTextLength(form.description) < 70) {
    errors.description = 'התיאור חייב להכיל לפחות 70 תווים'; ok = false
  } else if (/<a\b/i.test(form.description)) {
    errors.description = 'התיאור לא יכול להכיל קישורים'; ok = false
  }

  if (form.occurrences.length === 0) {
    errors.occurrences = 'יש להוסיף לפחות מועד אחד לאירוע'; ok = false
  }

  const today = todayLocal()
  form.occurrences.forEach((occ, i) => {
    if (occ._frozen) return
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

  if (!form.locationName.trim() && !form.addressLine1.trim()) {
    errors.locationRequired = 'יש להזין לפחות שם המקום או כתובת'; ok = false
  }

  if (!form.city.cityId && form.city.customCity === undefined) {
    errors.city = 'יש לבחור ישוב'; ok = false
  } else if (form.city.customCity !== undefined && !form.city.customCity?.trim()) {
    errors.customCity = 'יש להזין שם ישוב'; ok = false
  }

  if (form.city.customCity !== undefined && !form.city.region) {
    errors.region = 'יש לבחור אזור'; ok = false
  }

  if (!form.autoNav) {
    if (form.wazeLink.trim() && !isNavServiceLink(form.wazeLink, 'waze')) {
      errors.wazeLink = 'הקישור צריך להיות קישור שיתוף של Waze'; ok = false
    }
    if (form.gmapsLink.trim() && !isNavServiceLink(form.gmapsLink, 'gmaps')) {
      errors.gmapsLink = 'הקישור צריך להיות קישור שיתוף של Google Maps'; ok = false
    }
  }

  const priceNum = parseFloat(form.price)
  if (!form.isFree && (form.price === null || form.price === '')) {
    errors.price = 'יש להזין מחיר'; ok = false
  } else if (form.price !== null && form.price !== '' && (!isNaN(priceNum) && priceNum < 0)) {
    errors.price = 'המחיר לא יכול להיות שלילי'; ok = false
  } else if (!form.isFree && form.price !== null && form.price !== '' && (!isNaN(priceNum) && priceNum === 0)) {
    errors.price = 'לאירוע ללא תשלום הפעילו את "כניסה חופשית"'; ok = false
  }

  form.links.forEach((link, i) => {
    const e = {}
    if (!link.label.trim() || link.label.trim().length < 3) e.label = 'יש להוסיף תווית (לפחות 3 תווים)'
    if (!link.url.trim()) {
      e.url = 'יש להוסיף קישור או מספר טלפון'
    } else if (link.type === 'phone' && !isValidPhone(link.url)) {
      e.url = 'מספר טלפון לא תקין'
    } else if (link.type === 'link' && !isValidUrl(link.url)) {
      e.url = 'כתובת URL לא תקינה'
    }
    if (Object.keys(e).length) { linkErrors[i] = e; ok = false }
    else linkErrors[i] = {}
  })

  if (form.showContactPhone && form.contactSource === 'custom') {
    if (!form.customPhone.trim()) { errors.customPhone = 'יש להזין מספר טלפון'; ok = false }
    else if (!normalizeIsraeliPhone(form.customPhone)) { errors.customPhone = 'מספר טלפון לא תקין'; ok = false }
  }

  return ok
}

// --- AI generation (add mode only) ---
const aiText = ref('')
const aiExpanded = ref(false)
const aiLoading = ref(false)
const aiError = ref('')
const showAiOverrideConfirm = ref(false)

// Whole-form busy state — true while the AI extracts or while the event saves.
// Drives the disabled/dimmed form overlay and the footer button.
const formBusy = computed(() => aiLoading.value || isSubmitting.value)

// True when the form holds anything beyond a pristine fresh-add state — used to
// warn before AI output overwrites work already entered.
function hasUserData() {
  const occ = form.occurrences
  const firstOccPristine =
    occ.length === 1 &&
    occ[0]?.date === todayLocal() &&
    occ[0]?.hasTime === true &&
    occ[0]?.startTime === '08:00'
  return !!(
    form.title.trim() ||
    form.shortDescription.trim() ||
    getTextLength(form.description) > 0 ||
    form.mainCategory ||
    form.categories.length ||
    form.locationName.trim() ||
    form.addressLine1.trim() ||
    form.locationNotes.trim() ||
    form.price !== null ||
    form.isFree ||
    !form.autoNav ||
    form.links.length ||
    form.media.length ||
    !firstOccPristine
  )
}

function onAiGenerate() {
  if (hasUserData()) showAiOverrideConfirm.value = true
  else runAiGenerate()
}

function confirmAiOverride() {
  showAiOverrideConfirm.value = false
  runAiGenerate()
}

async function runAiGenerate() {
  if (!aiText.value.trim() || aiLoading.value) return
  aiLoading.value = true
  aiError.value = ''
  try {
    const dto = await $fetch('/api/publisher/event/ai-generate', { method: 'POST', body: { text: aiText.value } })
    applyAiResult(dto)
    // Surface every field the AI left empty by running the full form validation.
    Object.keys(errors).forEach((k) => { errors[k] = '' })
    Object.keys(occurrenceErrors).forEach((k) => { occurrenceErrors[k] = {} })
    linkErrors.splice(0)
    await nextTick()
    validate()
    // Bring the filled-in details section to the top so the user sees the result.
    detailsSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (err) {
    const status = err?.statusCode || err?.response?.status || err?.status
    if (status === 401) {
      aiError.value = 'ההתחברות פגה. רעננו את הדף והתחברו מחדש.'
    } else if (status === 429) {
      aiError.value = 'יותר מדי בקשות. נסו שוב בעוד רגע.'
    } else {
      aiError.value = err?.data?.message || err?.message || 'אירעה שגיאה ביצירת האירוע, נסו שוב'
    }
  } finally {
    aiLoading.value = false
  }
}

// Map the AI DTO onto the reactive form. Mirrors initFromData's field mapping.
function applyAiResult(dto) {
  if (!dto || typeof dto !== 'object') return
  if (dto.title) form.title = dto.title
  if (dto.shortDescription) form.shortDescription = dto.shortDescription
  if (dto.fullDescription) form.description = dto.fullDescription
  if (dto.mainCategory) form.mainCategory = dto.mainCategory
  form.categories = Array.isArray(dto.categories)
    ? dto.categories.filter(c => c && c !== dto.mainCategory).slice(0, 3)
    : []

  const loc = dto.location || {}
  form.locationName = loc.locationName || ''
  form.addressLine1 = loc.addressLine1 || ''
  form.locationNotes = loc.locationDetails || ''
  if (loc.cityType === 'listed' && loc.city && CITIES[loc.city]) {
    form.city = { cityId: loc.city, customCity: undefined, region: CITIES[loc.city].region }
  } else if (loc.city) {
    form.city = { cityId: '', customCity: loc.city, region: loc.region || '' }
  } else {
    form.city = { cityId: '', customCity: undefined, region: '' }
  }
  if (loc.wazeNavLink || loc.gmapsNavLink) {
    form.autoNav = false
    form.wazeLink = loc.wazeNavLink || ''
    form.gmapsLink = loc.gmapsNavLink || ''
  } else {
    form.autoNav = true
    form.wazeLink = ''
    form.gmapsLink = ''
  }

  if (dto.price === 0) {
    form.isFree = true
    form.price = null
  } else if (typeof dto.price === 'number') {
    form.isFree = false
    form.price = dto.price
  } else {
    form.isFree = false
    form.price = null
  }

  // Replace the default occurrence with whatever the AI found. If it found none,
  // clear the list entirely (empty array) so the user sees no date rows — the
  // validation pass then flags "יש להוסיף לפחות מועד אחד לאירוע", making it obvious
  // they must add one (rather than silently leaving today 08:00–09:00 in place).
  form.occurrences = (Array.isArray(dto.occurrences) ? dto.occurrences : []).map(o => ({
    _key: nextKey(),
    date: o.date || '',
    hasTime: o.hasTime !== false,
    startTime: o.hasTime !== false ? (o.startTime || '08:00') : '',
    endTime: o.hasTime !== false ? (o.endTime || '') : '',
    _frozen: false,
  }))

  form.links = Array.isArray(dto.urls)
    ? dto.urls
        .filter(u => u && (u.Title || u.Url))
        .map(u => ({ _key: nextKey(), type: u.type === 'phone' ? 'phone' : 'link', label: u.Title || '', url: u.Url || '' }))
    : []
}

// --- Submit ---
async function uploadMediaFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1]
        const result = await $fetch('/api/publisher/media', {
          method: 'POST',
          body: { file: base64, mimetype: file.type, filename: file.name },
        })
        resolve(result)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

function buildEventPayload(f, allMedia) {
  const payload = {
    title:            f.title,
    shortDescription: f.shortDescription,
    fullDescription:  f.description,
    occurrences:      f.occurrences.map(o => ({ date: o.date, hasTime: o.hasTime, startTime: o.startTime, endTime: o.endTime || null })),
    multiDayEvent:    f.multiDayEvent,
    mainCategory:     f.mainCategory,
    categories:       f.categories,
    location: {
      city:          f.city.cityId || f.city.customCity || '',
      // Mirror the wa-bot contract: cityType is always set; region only for custom
      // cities (listed cities derive their region from CITIES on read).
      cityType:      f.city.cityId ? 'listed' : 'custom',
      region:        f.city.cityId ? undefined : (f.city.region || undefined),
      locationName:  f.locationName,
      addressLine1:  f.addressLine1,
      locationNotes: f.locationNotes,
      wazeNavLink:   f.autoNav ? null : (normalizeUrl(f.wazeLink) || null),
      gmapsNavLink:  f.autoNav ? null : (normalizeUrl(f.gmapsLink) || null),
    },
    price: f.isFree ? 0 : (f.price ?? null),
    urls:  f.links.map(l => ({ Title: l.label, Url: l.type === 'link' ? normalizeUrl(l.url) : l.url, type: l.type })),
    media: allMedia,
    showContactPhone:   f.showContactPhone,
    customContactPhone: (f.showContactPhone && f.contactSource === 'custom') ? f.customPhone : '',
  }
  if (onBehalfMode.value === 'existing' && onBehalfPublisher.value?.id)
    payload.onBehalfPublisherId = onBehalfPublisher.value.id
  else if (onBehalfMode.value === 'new' && onBehalfPhone.value)
    payload.onBehalfPhone = onBehalfPhone.value
  return payload
}

async function onSubmit() {
  if (!validate()) {
    nextTick(() => {
      // Covers every error marker in the form: FormFields, link rows, and the price block
      const firstError = bodyEl.value?.querySelector(
        '.FormField--error, .LinkRow--hasErrors, .AddEventPage-priceField--error',
      )
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const focusable = firstError.querySelector('input, textarea, button, select')
        focusable?.focus()
      }
    })
    return
  }
  isSubmitting.value = true
  submitError.value = ''
  try {
    // Upload new media files — snapshot array first to avoid mutation during upload
    const mediaToUpload = [...form.media]
    const uploadedMedia = await Promise.all(mediaToUpload.map(f => uploadMediaFile(f)))
    const allMedia = [...existingMedia.value, ...uploadedMedia]
    const payload = buildEventPayload(toRaw(form), allMedia)

    let eventId
    if (props.mode === 'edit') {
      await $fetch(`/api/publisher/event/${props.initialData.id}`, { method: 'PATCH', body: payload })
      eventId = props.initialData.id
    } else {
      const result = await $fetch('/api/publisher/events', { method: 'POST', body: payload })
      eventId = result.id
    }
    if (props.draftKey) clearDraft(props.draftKey)
    emit('submitted', { id: eventId, mode: props.mode })
    emit('close')
  } catch (err) {
    if (err?.response?.status === 401 || err?.status === 401 || err?.statusCode === 401) {
      const key = saveDraft(props.mode, props.initialData?.id, form, existingMedia.value)
      const returnTo = props.mode === 'edit'
        ? `/publisher/events/${props.initialData?.id}?modal=edit&draft=${key}`
        : `/publisher/events?modal=add&draft=${key}`
      await navigateTo(`/login?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    submitError.value = err?.data?.message || err?.message || 'אירעה שגיאה, נסו שנית'
  } finally {
    isSubmitting.value = false
  }
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
  form.isFree = false
  form.links = []
  form.media = []
  form.categories = []
  form.multiDayEvent = true
  Object.keys(errors).forEach((k) => { errors[k] = '' })
  Object.keys(occurrenceErrors).forEach((k) => { occurrenceErrors[k] = {} })
  linkErrors.splice(0)
  existingMedia.value = []
  showMainPicker.value = false
  showOtherPicker.value = false
  submitError.value = ''
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

  &-footerDelete {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    width: 100%;
    margin-top: var(--spacing-sm);
    padding: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    font-weight: 600;
    color: var(--color-error);
    background: transparent;
    border: 1.5px solid var(--color-error);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:not(:disabled):hover { background: rgba(211, 47, 47, 0.08); }
  }

  &-onBehalf {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  &-onBehalfRadios {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-onBehalfOption {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &-onBehalfRadio {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    user-select: none;

    input[type='radio'] { accent-color: var(--brand-dark-green); cursor: pointer; }
  }

  &-onBehalfField {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &-onBehalfError {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-error);
  }
}

// Form styles (kept from AddEventPage)
.AddEventPage {
  &-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);

    > * { transition: opacity 0.15s; }
  }

  // While the AI extracts or the event saves: block all interaction and dim the
  // event-field sections so they read as disabled (covers the rich-text editor
  // and other custom inputs). The AI card is left bright so its spinner stays
  // the focus during generation.
  &-form--busy {
    pointer-events: none;

    > *:not(.EventFormAi) { opacity: 0.55; }
  }

  &-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-xl);
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

  &-contactPhone {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }
  &-contactPhoneOptions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding-inline-start: var(--spacing-md);
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

  &-locationGroup {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  &-locationError {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-error);
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

  &-priceField--error .FormInput {
    border-color: var(--color-error) !important;
  }

  &-priceRow {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &-priceInput {
    text-align: center;
    width: 7rem;
    flex: 0 0 auto;
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

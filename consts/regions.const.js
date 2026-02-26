/**
 * Region and city constants — single source of truth for map/filter and future event data
 * Region keys (center, golan, upper) match AreaFilterMap SVG classes and filter store
 */
export const REGIONS = {
  center: { id: 'center', label: 'הגליל העליון המרכזי' },
  golan: { id: 'golan', label: 'צפון ומרכז רמת הגולן' },
  upper: { id: 'upper', label: 'אצבע הגליל' },
}

/** Valid region keys for filter/URL (derived from REGIONS) */
export const REGION_KEYS = Object.keys(REGIONS)

export const CITIES = {
  // =========================
  // צפון ומרכז רמת הגולן
  // =========================

  Katzrin: { title: 'קצרין', region: 'golan' },
  HadNes: { title: 'חד נס', region: 'golan' },
  AloneiHaBashan: { title: 'אלוני הבשן', region: 'golan' },
  Hispin: { title: 'חיספין', region: 'golan' },
  KidmatTzvi: { title: 'קדמת צבי', region: 'golan' },
  MeromGolan: { title: 'מרום גולן', region: 'golan' },
  EinZivan: { title: 'עין זיוון', region: 'golan' },
  Ortal: { title: 'אורטל', region: 'golan' },
  ElRom: { title: 'אל רום', region: 'golan' },
  Odem: { title: 'אודם', region: 'golan' },
  Shaal: { title: 'שעל', region: 'golan' },
  KelaAlon: { title: 'קלע אלון', region: 'golan' },
  RamatTrump: { title: 'רמת טראמפ', region: 'golan' },
  Nimrod: { title: 'נמרוד', region: 'golan' },
  NeveAtiv: { title: 'נווה אטי״ב', region: 'golan' },
  MajdalShams: { title: "מג'דל שמס", region: 'golan' },
  Masade: { title: 'מסעדה', region: 'golan' },
  Buqata: { title: 'בוקעאתא', region: 'golan' },
  EinQiniyye: { title: 'עין קנייא', region: 'golan' },
  MetzokOravim: { title: 'מצוק עורבים', region: 'golan' },

  // =========================
  // אצבע הגליל
  // =========================

  Metula: { title: 'מטולה', region: 'upper' },
  KiryatShmona: { title: 'קריית שמונה', region: 'upper' },
  Ghajar: { title: "ע'ג'ר", region: 'upper' },
  KfarYuval: { title: 'כפר יובל', region: 'upper' },
  Margaliot: { title: 'מרגליות', region: 'upper' },
  RamotNaftali: { title: 'רמות נפתלי', region: 'upper' },
  BeitHillel: { title: 'בית הלל', region: 'upper' },
  ShearYashuv: { title: 'שאר ישוב', region: 'upper' },
  Dishon: { title: 'דישון', region: 'upper' },
  Malkia: { title: 'מלכיה', region: 'upper' },
  Yiftach: { title: 'יפתח', region: 'upper' },
  Manara: { title: 'מנרה', region: 'upper' },
  MisgavAm: { title: 'משגב עם', region: 'upper' },
  KfarGiladi: { title: 'כפר גלעדי', region: 'upper' },
  KfarBlum: { title: 'כפר בלום', region: 'upper' },
  HaGoshrim: { title: 'הגושרים', region: 'upper' },
  Dafna: { title: 'דפנה', region: 'upper' },
  Dan: { title: 'דן', region: 'upper' },
  Snir: { title: 'שניר', region: 'upper' },
  SdeNehemia: { title: 'שדה נחמיה', region: 'upper' },
  LehavotHaBashan: { title: 'להבות הבשן', region: 'upper' },
  MaayanBaruch: { title: 'מעין ברוך', region: 'upper' },
  NeotMordechai: { title: 'נאות מרדכי', region: 'upper' },
  Shamir: { title: 'שמיר', region: 'upper' },
  Amir: { title: 'עמיר', region: 'upper' },
  KfarSzold: { title: 'כפר סאלד', region: 'upper' },
  Gonen: { title: 'גונן', region: 'upper' },

  // =========================
  // הגליל העליון המרכזי
  // =========================

  Hula: { title: 'חולתה', region: 'center' },
  YesudHaMaala: { title: 'יסוד המעלה', region: 'center' },
  SdeEliezer: { title: 'שדה אליעזר', region: 'center' },
  Alma: { title: 'עלמה', region: 'center' },
  Dovev: { title: 'דוב"ב', region: 'center' },
  Tzivon: { title: 'צבעון', region: 'center' },
  KfarHoshen: { title: 'כפר חושן (ספסופה)', region: 'center' },
  Meron: { title: 'מירון', region: 'center' },
  KfarShamai: { title: 'כפר שמאי', region: 'center' },
  Shefer: { title: 'שפר', region: 'center' },
  HemdatYamim: { title: 'חמדת ימים', region: 'center' },
  Parod: { title: 'פרוד', region: 'center' },
  Jish: { title: "ג'יש (גוש חלב)", region: 'center' },
  Dalton: { title: 'דלתון', region: 'center' },
  KeremBenZimra: { title: 'כרם בן זמרה', region: 'center' },
  Kadita: { title: 'קדיתה', region: 'center' },
  EinZeitim: { title: 'עין זיתים', region: 'center' },
  OrHaGanuz: { title: 'אור הגנוז', region: 'center' },
  BarYochai: { title: 'בר יוחאי', region: 'center' },
  Birya: { title: 'ביריה', region: 'center' },
  MishmarHaYarden: { title: 'משמר הירדן', region: 'center' },
  Gadot: { title: 'גדות', region: 'center' },
  Avivim: { title: 'אביבים', region: 'center' },
  KfarHaNasi: { title: 'כפר הנשיא', region: 'center' },
  Machanayim: { title: 'מחניים', region: 'center' },
  AyeletHaShahar: { title: 'איילת השחר', region: 'center' },
  Amirim: { title: 'אמירים', region: 'center' },
  Elifelet: { title: 'אליפלט', region: 'center' },
  Karkom: { title: 'כרכום', region: 'center' },
  Safed: { title: 'צפת', region: 'center' },
  RoshPina: { title: 'ראש פינה', region: 'center' },
  HatzorHaGlilit: { title: 'חצור הגלילית', region: 'center' },
}

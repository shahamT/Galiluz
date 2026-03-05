<template>
  <LayoutAppShell>
    <LayoutContentCard>
      <article class="AboutPage">
        <header class="AboutPage-hero">
          <img
            src="/imgs/default-event-bg.webp"
            alt=""
            class="AboutPage-heroImage"
          />
          <div class="AboutPage-heroOverlay" aria-hidden="true" />
          <h1 class="AboutPage-heroTitle">
            אודות גלילו"ז
          </h1>
        </header>
        <section class="AboutPage-section">
          <h2 class="AboutPage-sectionTitle">
            הסיפור
          </h2>
          <p class="AboutPage-text">
            כשעברתי לגור בצפון גיליתי שהקהילה והעסקים הקטנים פה עסוקים באופן מתמיד בלהרים אירועים מיוחדים ונעימים - <span class="AboutPage-highlight">הופעות קטנות, מפגשים קהילתיים, סדנאות, ירידים, טיולים ואירועים מיוחדים</span>.
          </p>
          <p class="AboutPage-text">
            אבל, גיליתי גם שהדרך לשמוע על האירועים האלו היא כמעט תמיד דרך קבוצות וואטסאפ, פוסטים בפייסבוק או פשוט מפה לאוזן.
            האירועים קיימים, האנשים מגיעים - אבל <span class="AboutPage-highlight">המידע מפוזר בכל מקום</span>.
          </p>
        </section>
        <section class="AboutPage-section">
          <h2 class="AboutPage-sectionTitle">
            למה גלילו״ז
          </h2>
          <p class="AboutPage-text">
            <span class="AboutPage-highlight">גלילו״ז נבנה מתוך הצורך האישי לעשות סדר בכל מה שקורה בצפון</span> ולהיות מסוגל לראות בקלות מה קורה היום, מחר, או בסופש ממש מחוץ לבית.
          </p>
          <p class="AboutPage-text">
            מסתבר שהצורך הזה משותף להרבה יותר אנשים משציפיתי - כל מי ששמע על הרעיון אמר שזה בדיוק מה שחסר כרגע לצפון:
            מקום שבו מארגני אירועים יכולים לשתף את מה שהם יוצרים, ומקום שבו תושבים ומבקרים יכולים <span class="AboutPage-highlight">לגלות בכל רגע</span> מה קורה סביבם - לפעמים ממש כמה דקות מהבית.
          </p>
        </section>
        <section class="AboutPage-section">
          <h2 class="AboutPage-sectionTitle">
            החזון
          </h2>
          <p class="AboutPage-text">
            הצפון מלא באנשים מעניינים, יוזמות קטנות ותרבות מקומית - ואירועים מיוחדים שקורים כל הזמן.
            גלילו״ז נוצר כדי לעזור לתושבים ולמבקרים לגלות אותם - <span class="AboutPage-highlight">ולהנות מכל מה שהופך את הצפון למה שהוא: קהילתי, חי, תוסס ומלא בקסם</span> ✨
          </p>
        </section>
        <section class="AboutPage-section AboutPage-section--twoCol">
          <div class="AboutPage-twoCol">
            <img
              src="/imgs/personal-img-shaham-tamir.jpg"
              alt="שחם טמיר"
              class="AboutPage-personImage"
            />
            <div class="AboutPage-twoCol-right">
              <h2 class="AboutPage-sectionTitle">
                מי אני?
              </h2>
              <p class="AboutPage-text AboutPage-text--right">
                אני שחם טמיר. עברתי לגור בצפון והתאהבתי באיזור, בקהילה ובכל מה שקורה כאן 🌿 גלילו״ז התחיל מתוך הרצון הפשוט שלי לגלות מה קורה סביבי - והפך לפרויקט שמנסה לעזור לעוד אנשים למצוא את האירועים, האנשים והיוזמות <span class="AboutPage-highlight">שממלאים את הצפון בחיים</span>.
              </p>
            </div>
          </div>
        </section>
      </article>
    </LayoutContentCard>
  </LayoutAppShell>
</template>

<script setup>
defineOptions({ name: 'AboutPage' })

useHead({
  title: 'אודות | גלילו"ז',
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.AboutPage {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  min-width: 0;

  &-hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-height: 16rem;
    border-radius: var(--radius-md);
    overflow: hidden;
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
    background: linear-gradient(
      to bottom,
      transparent,
      var(--brand-dark-green)
    );
    pointer-events: none;
  }

  &-heroTitle {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-2xl);
    font-size: var(--font-size-4xl);
    font-weight: 700;
    color: var(--color-background);
    text-shadow: var(--text-shadow-overlay);

    @include mobile {
      font-size: var(--font-size-4xl);
      padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
    }
  }

  &-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);

    &--twoCol {
      gap: 0;
    }
  }

  &-twoCol {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: var(--spacing-3xl);
    direction: ltr;

    @include mobile {
      flex-direction: column;
      align-items: stretch;
      direction: rtl;
    }
  }

  &-twoCol-right {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
    min-width: 0;
    direction: rtl;

    .AboutPage-sectionTitle {
      text-align: right;
    }
  }

  &-personImage {
    flex-shrink: 0;
    width: 12rem;
    height: 12rem;
    object-fit: cover;
    border-radius: var(--radius-lg);

    @include mobile {
      width: 100%;
      max-width: min(16rem, 100%);
      height: auto;
      aspect-ratio: 1;
      align-self: center;
    }
  }

  &-sectionTitle {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--brand-dark-green);

    @include mobile {
      font-size: var(--font-size-xl);
    }
  }

  &-text {
    margin: 0;
    font-size: var(--font-size-base);
    line-height: 1.6;
    color: var(--color-text);

    @include mobile {
      font-size: var(--font-size-lg);
    }

    &--right {
      text-align: right;
    }
  }

  &-highlight {
    font-weight: 600;
    color: var(--brand-dark-green);
  }

  &-list {
    margin: 0;
    padding-inline-start: var(--spacing-xl);
    font-size: var(--font-size-base);
    line-height: 1.8;
    color: var(--color-text);

    @include mobile {
      font-size: var(--font-size-lg);
    }
  }
}
</style>

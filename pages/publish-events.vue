<template>
  <LayoutAppShell>
    <LayoutContentCard>
      <article class="PublishEventsPage">
        <header class="PublishEventsPage-hero">
          <img
            src="/imgs/default-event-bg.webp"
            alt=""
            class="PublishEventsPage-heroImage"
          />
          <div class="PublishEventsPage-heroOverlay" aria-hidden="true" />
          <h1 class="PublishEventsPage-heroTitle">
            איך לפרסם אירועים בגלילו"ז?
          </h1>
        </header>
        <section class="PublishEventsPage-section">
          <h2 class="PublishEventsPage-sectionTitle">
            מארגנים אירועים בצפון? 🎉
          </h2>
          <p class="PublishEventsPage-text">
            הופעות, מסיבות, הרצאות, אוכל, ספורט ועוד... אירועים קטנים וגדולים, בין אם אתם חבורה שמארגנת משחק כדורגל וערב ג'ימג'ום או עסק שמפרסם יריד או מסיבה גדולים:
            <span class="PublishEventsPage-highlight">גלילו"ז הוא המקום החדש לפרסם את האירועים שלכם בצפון לקהל הרחב!</span>
          </p>
        </section>
        <section class="PublishEventsPage-section">
          <p class="PublishEventsPage-text">
            גלילו"ז מציג את כל האירועים בתצוגה יומית וחודשית שניתנת לסינון לפי קטגוריות, איזורים וימים - כדי שכל מי שרוצה לדעת מה קורה בצפון יוכל למצוא אתכם במהירות! 📅
          </p>
        </section>
        <a
          :href="PUBLISH_EVENT_WHATSAPP_LINK"
          target="_blank"
          rel="noopener noreferrer"
          class="PublishEventsPage-ctaButton"
        >
          <span class="PublishEventsPage-ctaIcon" aria-hidden="true" />
          <span>פרסמו אירוע בגלילו"ז</span>
        </a>
        <section class="PublishEventsPage-section PublishEventsPage-section--twoCol">
          <h2 class="PublishEventsPage-sectionTitle">
            איך מפרסמים אירועים בגלילו"ז? 🤖
          </h2>
          <div class="PublishEventsPage-twoCol">
            <img
              src="/imgs/whatsap-galiluz-bot.jpg"
              alt="גלילו״ז בוט בוואטסאפ"
              class="PublishEventsPage-botImage"
            />
            <div class="PublishEventsPage-twoCol-right">
              <ol class="PublishEventsPage-steps">
                <li>נכנסים לבוט שלנו במספר <a :href="BOT_WHATSAPP_LINK" target="_blank" rel="noopener noreferrer" class="PublishEventsPage-link">0552835970</a>, כותבים לו "היי" כדי להתחיל שיחה</li>
                <li>בוחרים ב"פרסום אירוע" ואז מכניסים בהודעה אחת את כל הפרטים של האירוע שלכם ואת התיאור שאתם רוצים שיופיע</li>
                <li>הבוט שלנו יודע לעבד לבד את כל הפרטים שהוא צריך</li>
                <li>אפשר לפרסם אירוע חד פעמי, אירוע מתמשך או כזה שחוזר על עצמו</li>
                <li>בכל שלב אפשר להיכנס ולערוך את האירועים שלכם או למחוק אותם</li>
              </ol>
            </div>
          </div>
        </section>
        <section class="PublishEventsPage-section">
          <h2 class="PublishEventsPage-sectionTitle">
            יש לכם שאלה? צריכים עזרה? ❓
          </h2>
          <p class="PublishEventsPage-text">
            כתבו לנו למספר <a :href="`https://wa.me/${supportNumber}`" target="_blank" rel="noopener noreferrer" class="PublishEventsPage-link">0559896278</a> 📱
          </p>
        </section>
      </article>
    </LayoutContentCard>
  </LayoutAppShell>
</template>

<script setup>
import { PUBLISH_EVENT_WHATSAPP_LINK, BOT_WHATSAPP_LINK } from '~/consts/ui.const'

defineOptions({ name: 'PublishEventsPage' })

const supportNumber = '972559896278'

useHead({
  title: 'איך לפרסם אירועים בגלילו"ז?',
})
</script>

<style lang="scss">
@use '~/assets/css/breakpoints' as *;

.PublishEventsPage {
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
    text-align: center;

    @include mobile {
      font-size: var(--font-size-4xl);
      padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
    }
  }

  &-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);

    &--twoCol .PublishEventsPage-sectionTitle {
      margin-bottom: var(--spacing-sm);
    }
  }

  &-ctaButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    height: 2.5rem;
    padding: 0 var(--spacing-xl);
    margin-bottom: 0;
    background-color: var(--brand-dark-green);
    color: var(--chip-text-white);
    font-size: var(--font-size-base);
    font-weight: 600;
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background-color 0.2s ease, opacity 0.2s ease;
    align-self: flex-start;

    &:hover,
    &:active {
      opacity: 0.9;
    }

    @include mobile {
      width: 100%;
      align-self: stretch;
      height: var(--section-header-height);
      font-size: var(--font-size-md);
      padding: 0 var(--spacing-md);
    }
  }

  &-ctaIcon {
    display: inline-block;
    width: 1.375rem;
    height: 1.375rem;
    flex-shrink: 0;
    background-color: currentColor;
    mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    mask-size: contain;
    -webkit-mask: url('/icons/whatsapp-icon.svg') no-repeat center;
    -webkit-mask-size: contain;
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
  }

  &-twoCol {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: var(--spacing-3xl);
    direction: ltr;

    @include mobile {
      flex-direction: column-reverse;
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
  }

  &-botImage {
    flex-shrink: 0;
    width: 14rem;
    height: auto;
    object-fit: contain;
    border-radius: var(--radius-lg);

    @include mobile {
      width: 100%;
      max-width: min(18rem, 100%);
      align-self: center;
    }
  }

  &-steps {
    margin: 0;
    padding-inline-start: var(--spacing-xl);
    font-size: var(--font-size-base);
    line-height: 1.8;
    color: var(--color-text);

    @include mobile {
      font-size: var(--font-size-lg);
    }

    li {
      margin-bottom: var(--spacing-sm);

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  &-highlight {
    font-weight: 600;
    color: var(--brand-dark-green);
  }

  &-link {
    color: var(--brand-dark-green);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
